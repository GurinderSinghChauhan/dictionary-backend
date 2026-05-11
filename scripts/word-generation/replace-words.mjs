import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";
import { parseArrayCell, readWorkbookRows } from "./workbook-utils.mjs";

dotenv.config();

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workbookPath =
  process.argv[2] || path.join(scriptDir, "word-senses.xlsx");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeWord(value) {
  return normalizeText(value).toLowerCase();
}

function getGoogleSheetId(value) {
  const match = String(value).match(/\/spreadsheets\/d\/([^/]+)/);
  return match?.[1] || value;
}

function isRemoteSource(value) {
  return /^https?:\/\//i.test(String(value));
}

async function readSourceRows(source) {
  if (!isRemoteSource(source)) {
    return readWorkbookRows(source);
  }

  const sheetId = getGoogleSheetId(source);
  const response = await fetch(
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheet: ${response.status}`);
  }

  const csv = await response.text();
  const workbook = xlsx.read(csv, { type: "string" });
  const sheetName = workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
  });

  return { workbook, sheetName, rows };
}

async function connectDictionaryDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  await mongoose.connect(uri, { dbName: "dictionary" });
  return mongoose.connection.db;
}

function isSenseWorkbook(rows) {
  return rows.some(
    (row) => "senseId" in row || "normalizedWord" in row || "contextType" in row
  );
}

function buildSearchText(document) {
  return [
    document.word,
    document.partOfSpeech,
    document.meaning,
    document.shortDefinition,
    document.exampleSentence,
    ...document.wordForms,
    ...document.synonyms,
    ...document.antonyms,
    ...document.tags,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(" ");
}

function senseRowToBaseWord(row) {
  return {
    word: normalizeWord(row.normalizedWord || row.word),
    partOfSpeech: normalizeText(row.partOfSpeech),
    pronunciation: normalizeText(row.pronunciation),
    wordForms: parseArrayCell(row.wordForms),
    meaning: normalizeText(row.meaning),
    exampleSentence: normalizeText(row.exampleSentence),
    synonyms: parseArrayCell(row.synonyms),
    antonyms: parseArrayCell(row.antonyms),
    memoryTrick: normalizeText(row.memoryTrick),
    origin: normalizeText(row.origin),
    positivePrompt: normalizeText(row.positivePrompt),
    negativePrompt: normalizeText(row.negativePrompt),
    imageURL: normalizeText(row.imageURL),
    promptId: normalizeText(row.promptId),
  };
}

function senseRowToDocument(row, wordId, importedFrom) {
  const contextType = normalizeText(row.contextType);
  const contextKey = normalizeText(row.contextKey).toLowerCase();
  const imageURL = normalizeText(row.imageURL);
  const tags = contextKey ? [contextKey] : [];
  const document = {
    senseId: normalizeText(row.senseId),
    wordId,
    word: normalizeWord(row.word),
    normalizedWord: normalizeWord(row.normalizedWord || row.word),
    partOfSpeech: normalizeText(row.partOfSpeech),
    pronunciation: normalizeText(row.pronunciation),
    wordForms: parseArrayCell(row.wordForms),
    meaning: normalizeText(row.meaning),
    shortDefinition: normalizeText(row.shortDefinition),
    exampleSentence: normalizeText(row.exampleSentence),
    synonyms: parseArrayCell(row.synonyms),
    antonyms: parseArrayCell(row.antonyms),
    memoryTrick: normalizeText(row.memoryTrick),
    origin: normalizeText(row.origin),
    contexts: [
      {
        type: contextType,
        key: contextType === "generic" ? "" : contextKey,
        priority: contextType === "generic" ? 100 : 10,
      },
    ],
    image: {
      promptPositive: normalizeText(row.positivePrompt),
      promptNegative: normalizeText(row.negativePrompt),
      url: imageURL,
      provider: imageURL ? "cloudinary" : "",
      status: imageURL ? "ready" : normalizeText(row.imageStatus) || "not_requested",
    },
    tags,
    searchText: "",
    source: {
      type: normalizeText(row.sourceType) || "import",
      model: normalizeText(row.sourceModel),
      importedFrom,
    },
    reviewStatus: normalizeText(row.reviewStatus) || "draft",
    status: "active",
    notes: normalizeText(row.notes),
  };

  document.searchText = buildSearchText(document);
  return document;
}

async function replaceSenseDocuments(rows, source) {
  const db = await connectDictionaryDb();
  const wordsCollection = db.collection("words");
  const sensesCollection = db.collection("word_senses");
  let wordUpserts = 0;
  let senseUpserts = 0;
  const contextCounts = {};
  const sheetSenseIds = [];

  for (const row of rows) {
    const word = normalizeWord(row.normalizedWord || row.word);
    const senseId = normalizeText(row.senseId);
    const contextType = normalizeText(row.contextType);

    if (!word || !senseId || !contextType) {
      throw new Error(`Invalid sense row for word "${row.word || ""}"`);
    }

    contextCounts[contextType] = (contextCounts[contextType] || 0) + 1;
    sheetSenseIds.push(senseId);

    const wordResult = await wordsCollection.findOneAndUpdate(
      { word },
      {
        $setOnInsert: {
          ...senseRowToBaseWord(row),
          word,
        },
      },
      { upsert: true, returnDocument: "after", includeResultMetadata: true }
    );

    if (!wordResult.lastErrorObject?.updatedExisting) {
      wordUpserts += 1;
    }

    const senseDocument = senseRowToDocument(row, wordResult.value._id, source);
    const senseResult = await sensesCollection.updateOne(
      { senseId },
      { $set: senseDocument },
      { upsert: true }
    );
    senseUpserts += senseResult.modifiedCount + senseResult.upsertedCount;
  }

  const staleDeleteResult = await sensesCollection.deleteMany({
    senseId: { $nin: sheetSenseIds },
    "source.importedFrom": {
      $regex: /^(google-sheet:|https?:\/\/|scripts\/word-generation\/word-senses\.xlsx)/,
    },
  });

  console.log(
    JSON.stringify(
      {
        database: "dictionary",
        collection: "word_senses",
        source,
        workbookRows: rows.length,
        contextCounts,
        wordUpserts,
        senseUpserts,
        deletedStaleSenses: staleDeleteResult.deletedCount,
        count: await sensesCollection.countDocuments({ status: "active" }),
      },
      null,
      2
    )
  );
}

async function main() {
  const sourceRows = await readSourceRows(workbookPath);

  if (sourceRows.rows.length === 0) {
    throw new Error(`No rows found in ${workbookPath}`);
  }

  if (!isSenseWorkbook(sourceRows.rows)) {
    throw new Error(
      "replace-words only supports the current word_senses format. Use a sheet with senseId, normalizedWord, and contextType columns."
    );
  }

  await replaceSenseDocuments(sourceRows.rows, workbookPath);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
