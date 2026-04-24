import path from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";
import {
  buildSenseId,
  legacyColumns,
  readWorkbookRows,
  senseColumns,
  stringifyArrayCell,
} from "./workbook-utils.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceWorkbookPath =
  process.argv[2] || path.join(scriptDir, "word-details.xlsx");
const targetWorkbookPath =
  process.argv[3] || path.join(scriptDir, "word-senses.xlsx");

const { rows } = readWorkbookRows(sourceWorkbookPath);

if (rows.length === 0) {
  throw new Error(`No rows found in ${sourceWorkbookPath}`);
}

const outputRows = rows.map((row, index) => {
  const normalizedWord = String(row.word || "").trim().toLowerCase();
  const shortDefinition = String(row.meaning || "")
    .trim()
    .split(/[.;]/)[0]
    .trim();

  const senseRow = {
    word: String(row.word || "").trim(),
    normalizedWord,
    partOfSpeech: String(row.partOfSpeech || "").trim(),
    senseId: buildSenseId(
      {
        word: normalizedWord,
        partOfSpeech: row.partOfSpeech,
        contextType: "generic",
        contextKey: "",
      },
      index
    ),
    isGeneric: "true",
    contextType: "generic",
    contextKey: "",
    meaning: String(row.meaning || "").trim(),
    shortDefinition,
    exampleSentence: String(row.exampleSentence || "").trim(),
    wordForms: stringifyArrayCell(row.wordForms),
    synonyms: stringifyArrayCell(row.synonyms),
    antonyms: stringifyArrayCell(row.antonyms),
    memoryTrick: String(row.memoryTrick || "").trim(),
    origin: String(row.origin || "").trim(),
    positivePrompt: String(row.positivePrompt || "").trim(),
    negativePrompt: String(row.negativePrompt || "").trim(),
    imageURL: String(row.imageURL || "").trim(),
    imageStatus: row.imageURL ? "ready" : "not_requested",
    sourceType: "import",
    sourceModel: "",
    reviewStatus: "draft",
    notes: "",
  };

  for (const column of legacyColumns) {
    if (!(column in row)) {
      continue;
    }
  }

  return senseRow;
});

const workbook = xlsx.utils.book_new();
const worksheet = xlsx.utils.json_to_sheet(outputRows, { header: senseColumns });
xlsx.utils.book_append_sheet(workbook, worksheet, "word_senses");
xlsx.writeFile(workbook, targetWorkbookPath);

console.log(
  JSON.stringify(
    {
      source: sourceWorkbookPath,
      target: targetWorkbookPath,
      rows: outputRows.length,
      columns: senseColumns,
    },
    null,
    2
  )
);
