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
const stringFields = [
  "word",
  "partOfSpeech",
  "pronunciation",
  "meaning",
  "exampleSentence",
  "memoryTrick",
  "origin",
  "positivePrompt",
  "negativePrompt",
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
  const seenWords = new Set();

  return rows.map((row, index) => {
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
}

async function main() {
  const documents = readWordDocuments();

  if (documents.length === 0) {
    throw new Error(`No word rows found in ${workbookPath}`);
  }

  const db = await connectDictionaryDb();
  const collection = db.collection("words");
  const beforeCount = await collection.countDocuments({});

  await collection.deleteMany({});
  const insertResult = await collection.insertMany(documents, {
    ordered: true,
  });
  const afterCount = await collection.countDocuments({});

  console.log(
    JSON.stringify(
      {
        database: "dictionary",
        collection: "words",
        source: workbookPath,
        deleted: beforeCount,
        inserted: insertResult.insertedCount,
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
