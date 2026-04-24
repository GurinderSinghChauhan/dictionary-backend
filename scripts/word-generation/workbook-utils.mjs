import xlsx from "xlsx";

export const legacyColumns = [
  "word",
  "partOfSpeech",
  "pronunciation",
  "wordForms",
  "meaning",
  "exampleSentence",
  "synonyms",
  "antonyms",
  "memoryTrick",
  "origin",
  "positivePrompt",
  "negativePrompt",
];

export const senseColumns = [
  "word",
  "normalizedWord",
  "partOfSpeech",
  "senseId",
  "isGeneric",
  "contextType",
  "contextKey",
  "meaning",
  "shortDefinition",
  "exampleSentence",
  "wordForms",
  "synonyms",
  "antonyms",
  "memoryTrick",
  "origin",
  "positivePrompt",
  "negativePrompt",
  "imageURL",
  "imageStatus",
  "sourceType",
  "sourceModel",
  "reviewStatus",
  "notes",
];

export function readWorkbookRows(workbookPath) {
  const workbook = xlsx.readFile(workbookPath);
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error(`No sheets found in ${workbookPath}`);
  }

  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
  });

  return { workbook, sheetName, rows };
}

export function writeWorkbookRows(workbook, sheetName, rows, columns) {
  workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(rows, {
    header: columns,
  });
}

export function normalizeWordKey(row) {
  return String(row.normalizedWord || row.word || "")
    .trim()
    .toLowerCase();
}

export function buildSenseId(row, rowIndex) {
  const normalizedWord = normalizeWordKey(row);
  const partOfSpeech = String(row.partOfSpeech || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const contextType = String(row.contextType || "generic")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const contextKey = String(row.contextKey || "default")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  return `${normalizedWord}-${partOfSpeech}-${contextType}-${contextKey}-${rowIndex + 1}`;
}

export function parseArrayCell(value) {
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

export function stringifyArrayCell(value) {
  return JSON.stringify(parseArrayCell(value));
}
