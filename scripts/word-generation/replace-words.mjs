import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";

dotenv.config();

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workbookPath =
  process.argv[2] || path.join(scriptDir, "word-details.xlsx");
const arrayFields = ["wordForms", "synonyms", "antonyms"];
const requiredStringFields = [
  "word",
  "partOfSpeech",
  "pronunciation",
  "meaning",
  "exampleSentence",
  "memoryTrick",
  "origin",
  "positivePrompt",
  "negativePrompt",
];
const optionalStringFields = [
  "imageURL",
  "promptId",
];

async function connectDictionaryDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  await mongoose.connect(uri, { dbName: "dictionary" });
  return mongoose.connection.db;
}

function parseArrayCell(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  const text = String(value || "").trim();
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Fall back to comma-separated cells for hand-edited workbooks.
  }

  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readWordDocuments() {
  const workbook = xlsx.readFile(workbookPath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error(`No sheets found in ${workbookPath}`);
  }

  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
  });
  const headerNames = new Set(Object.keys(rows[0] || {}));
  const stringFields = [
    ...requiredStringFields,
    ...optionalStringFields.filter((field) => headerNames.has(field)),
  ];
  const documentFields = [...stringFields, ...arrayFields];
  const seenWords = new Set();

  const documents = rows.map((row, index) => {
    const document = {};

    for (const field of stringFields) {
      document[field] = String(row[field] || "").trim();
    }

    document.word = document.word.toLowerCase();

    if (!document.word) {
      throw new Error(`Missing word in workbook row ${index + 2}`);
    }

    if (seenWords.has(document.word)) {
      throw new Error(`Duplicate word in workbook: ${document.word}`);
    }
    seenWords.add(document.word);

    for (const field of arrayFields) {
      document[field] = parseArrayCell(row[field]);
    }

    return document;
  });

  return { documents, documentFields };
}

function valuesAreEqual(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }

    if (left.length !== right.length) {
      return false;
    }

    return left.every((item, index) => item === right[index]);
  }

  return String(left ?? "") === String(right ?? "");
}

function getChangedFields(document, existingDocument, documentFields) {
  const changedFields = {};

  for (const field of documentFields) {
    if (!valuesAreEqual(document[field], existingDocument?.[field])) {
      changedFields[field] = document[field];
    }
  }

  return changedFields;
}

async function main() {
  const { documents, documentFields } = readWordDocuments();

  if (documents.length === 0) {
    throw new Error(`No word rows found in ${workbookPath}`);
  }

  const db = await connectDictionaryDb();
  const collection = db.collection("words");
  const beforeCount = await collection.countDocuments({});
  const workbookWords = documents.map((document) => document.word);
  const existingDocuments = await collection
    .find(
      { word: { $in: workbookWords } },
      {
        projection: Object.fromEntries(
          documentFields.map((field) => [field, 1])
        ),
      }
    )
    .toArray();
  const existingByWord = new Map(
    existingDocuments.map((document) => [document.word, document])
  );

  let unchanged = 0;
  let inserts = 0;
  let updates = 0;
  const operations = [];

  for (const document of documents) {
    const existingDocument = existingByWord.get(document.word);

    if (!existingDocument) {
      inserts += 1;
      operations.push({
        insertOne: {
          document,
        },
      });
      continue;
    }

    const changedFields = getChangedFields(
      document,
      existingDocument,
      documentFields
    );
    if (Object.keys(changedFields).length === 0) {
      unchanged += 1;
      continue;
    }

    updates += 1;
    operations.push({
      updateOne: {
        filter: { word: document.word },
        update: { $set: changedFields },
      },
    });
  }

  if (operations.length === 0) {
    const afterCount = await collection.countDocuments({});
    console.log(
      JSON.stringify(
        {
          database: "dictionary",
          collection: "words",
          source: workbookPath,
          workbookRows: documents.length,
          updates,
          inserts,
          unchanged,
          beforeCount,
          count: afterCount,
        },
        null,
        2
      )
    );
    return;
  }

  const writeResult = await collection.bulkWrite(operations, {
    ordered: false,
  });
  const afterCount = await collection.countDocuments({});

  console.log(
    JSON.stringify(
      {
        database: "dictionary",
        collection: "words",
        source: workbookPath,
        workbookRows: documents.length,
        updates,
        inserts,
        unchanged,
        matched: writeResult.matchedCount,
        modified: writeResult.modifiedCount,
        inserted: writeResult.insertedCount,
        beforeCount,
        count: afterCount,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
