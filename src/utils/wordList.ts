import fs from "fs";
import xlsx from "xlsx";

const EXCEL_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

const normalizeAndUnique = (items: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};

export const parseUniqueWordsFromText = (text: string, splitCsv = true) => {
  const items = text
    .split(/\r?\n/)
    .flatMap((line) => (splitCsv ? line.split(",") : [line]));
  return normalizeAndUnique(items);
};

export const parseUniqueWordsFromDiskFile = (filePath: string) => {
  const text = fs.readFileSync(filePath, "utf-8");
  return parseUniqueWordsFromText(text, false);
};

export const parseUniqueWordsFromUpload = (file: {
  mimetype: string;
  buffer: Buffer;
}) => {
  if (EXCEL_MIME_TYPES.has(file.mimetype)) {
    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
    });
    const flatWords = data.flat().filter(Boolean).map((w) => String(w));
    return normalizeAndUnique(flatWords);
  }

  if (file.mimetype === "text/plain") {
    const text = file.buffer.toString("utf-8");
    return parseUniqueWordsFromText(text, true);
  }

  throw new Error("Unsupported file type");
};
