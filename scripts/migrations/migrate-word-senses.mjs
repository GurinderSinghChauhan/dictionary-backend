import crypto from "node:crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const apply = process.argv.includes("--apply");

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function normalizeWord(word) {
  return String(word || "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function buildSenseId(word, partOfSpeech, contextType, contextKey, meaning) {
  const payload = [
    normalizeWord(word),
    normalizeText(partOfSpeech).toLowerCase(),
    contextType,
    normalizeText(contextKey).toLowerCase(),
    normalizeText(meaning).toLowerCase(),
  ].join("|");
  const hash = crypto.createHash("sha1").update(payload).digest("hex").slice(0, 12);

  return `${normalizeWord(word)}-${
    normalizeText(partOfSpeech).toLowerCase() || "unknown"
  }-${contextType}-${normalizeText(contextKey).toLowerCase() || "default"}-${hash}`;
}

function buildSearchText(document) {
  return [
    document.word,
    document.partOfSpeech,
    document.meaning,
    document.shortDefinition,
    document.exampleSentence,
    ...document.synonyms,
    ...document.antonyms,
    ...document.tags,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" ");
}

function toSenseDocument({
  wordDoc,
  payload,
  contextType,
  contextKey = "",
  importedFrom,
}) {
  const normalizedWord = normalizeWord(payload.word || wordDoc?.word);
  const partOfSpeech = normalizeText(payload.partOfSpeech);
  const meaning = normalizeText(payload.meaning);
  const shortDefinition = meaning.split(/[.;]/)[0]?.trim() || meaning;
  const imageURL = normalizeText(payload.imageURL);

  const document = {
    senseId: buildSenseId(
      normalizedWord,
      partOfSpeech,
      contextType,
      contextKey,
      meaning
    ),
    wordId: wordDoc?._id,
    word: normalizedWord,
    normalizedWord,
    partOfSpeech,
    pronunciation: normalizeText(payload.pronunciation),
    wordForms: normalizeArray(payload.wordForms),
    meaning,
    shortDefinition,
    exampleSentence: normalizeText(payload.exampleSentence),
    synonyms: normalizeArray(payload.synonyms),
    antonyms: normalizeArray(payload.antonyms),
    memoryTrick: normalizeText(payload.memoryTrick),
    origin: normalizeText(payload.origin),
    contexts: [
      {
        type: contextType,
        key: normalizeText(contextKey),
        priority: contextType === "generic" ? 100 : 10,
      },
    ],
    image: {
      promptPositive: normalizeText(payload.positivePrompt),
      promptNegative: normalizeText(payload.negativePrompt),
      url: imageURL,
      provider: imageURL ? "cloudinary" : "",
      status: imageURL ? "ready" : "not_requested",
    },
    tags:
      contextType === "generic"
        ? []
        : [normalizeText(contextKey).toLowerCase()].filter(Boolean),
    searchText: "",
    source: {
      type: "migration",
      model: "",
      importedFrom,
    },
    reviewStatus: "draft",
    status: "active",
    notes: "",
  };

  document.searchText = buildSearchText(document);
  return document;
}

async function connectDictionaryDb() {
  await mongoose.connect(requireEnv("MONGODB_URI"), { dbName: "dictionary" });
  return mongoose.connection.db;
}

async function main() {
  const db = await connectDictionaryDb();
  const wordsCollection = db.collection("words");
  const subjectCollection = db.collection("subject_words");
  const gradeCollection = db.collection("grade_words");
  const examCollection = db.collection("exam_words");
  const wordSensesCollection = db.collection("word_senses");

  const baseWords = await wordsCollection.find({}).toArray();
  const baseWordByNormalized = new Map(
    baseWords.map((document) => [normalizeWord(document.word), document])
  );

  const senseDocuments = [];

  for (const wordDoc of baseWords) {
    senseDocuments.push(
      toSenseDocument({
        wordDoc,
        payload: wordDoc,
        contextType: "generic",
        importedFrom: "legacy:words",
      })
    );
  }

  const subjectDocs = await subjectCollection.find({}).toArray();
  for (const subjectDoc of subjectDocs) {
    for (const payload of subjectDoc.words || []) {
      const normalizedWord = normalizeWord(payload.word);
      senseDocuments.push(
        toSenseDocument({
          wordDoc: baseWordByNormalized.get(normalizedWord),
          payload,
          contextType: "subject",
          contextKey: subjectDoc.subject,
          importedFrom: "legacy:subject_words",
        })
      );
    }
  }

  const gradeDocs = await gradeCollection.find({}).toArray();
  for (const gradeDoc of gradeDocs) {
    for (const payload of gradeDoc.words || []) {
      const normalizedWord = normalizeWord(payload.word);
      senseDocuments.push(
        toSenseDocument({
          wordDoc: baseWordByNormalized.get(normalizedWord),
          payload,
          contextType: "grade",
          contextKey: gradeDoc.grade,
          importedFrom: "legacy:grade_words",
        })
      );
    }
  }

  const examDocs = await examCollection.find({}).toArray();
  for (const examDoc of examDocs) {
    for (const payload of examDoc.words || []) {
      const normalizedWord = normalizeWord(payload.word);
      senseDocuments.push(
        toSenseDocument({
          wordDoc: baseWordByNormalized.get(normalizedWord),
          payload,
          contextType: "exam",
          contextKey: examDoc.exam,
          importedFrom: "legacy:exam_words",
        })
      );
    }
  }

  const dedupedBySenseId = new Map();
  for (const document of senseDocuments) {
    if (!dedupedBySenseId.has(document.senseId)) {
      dedupedBySenseId.set(document.senseId, document);
    }
  }

  const dedupedDocuments = [...dedupedBySenseId.values()];

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          baseWords: baseWords.length,
          subjectDocs: subjectDocs.length,
          gradeDocs: gradeDocs.length,
          examDocs: examDocs.length,
          candidateSenses: senseDocuments.length,
          dedupedSenses: dedupedDocuments.length,
        },
        null,
        2
      )
    );
    return;
  }

  const operations = dedupedDocuments.map((document) => ({
    updateOne: {
      filter: { senseId: document.senseId },
      update: { $set: document },
      upsert: true,
    },
  }));

  const writeResult = await wordSensesCollection.bulkWrite(operations, {
    ordered: false,
  });

  console.log(
    JSON.stringify(
      {
        dryRun: false,
        baseWords: baseWords.length,
        subjectDocs: subjectDocs.length,
        gradeDocs: gradeDocs.length,
        examDocs: examDocs.length,
        candidateSenses: senseDocuments.length,
        dedupedSenses: dedupedDocuments.length,
        matched: writeResult.matchedCount,
        modified: writeResult.modifiedCount,
        upserted: writeResult.upsertedCount,
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
