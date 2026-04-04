import fs from "fs";
import os from "os";
import path from "path";
import xlsx from "xlsx";
import { describe, expect, it } from "vitest";
import {
  parseUniqueWordsFromDiskFile,
  parseUniqueWordsFromText,
  parseUniqueWordsFromUpload,
} from "../src/utils/wordList";

describe("wordList utils", () => {
  it("parseUniqueWordsFromText handles CSV splitting and de-duplication", () => {
    const input = "Apple, banana\nbanana, Carrot\n  apple  ,\n";
    const result = parseUniqueWordsFromText(input, true);

    expect(result).toEqual(["apple", "banana", "carrot"]);
  });

  it("parseUniqueWordsFromDiskFile reads one word per line and normalizes", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wordlist-test-"));
    const filePath = path.join(dir, "words.txt");

    fs.writeFileSync(filePath, "Alpha\nbeta\nalpha\n Gamma \n");

    const result = parseUniqueWordsFromDiskFile(filePath);
    expect(result).toEqual(["alpha", "beta", "gamma"]);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("parseUniqueWordsFromUpload parses text/plain uploads", () => {
    const file = {
      mimetype: "text/plain",
      buffer: Buffer.from("dog, cat\ndog\nbird", "utf-8"),
    };

    const result = parseUniqueWordsFromUpload(file);
    expect(result).toEqual(["dog", "cat", "bird"]);
  });

  it("parseUniqueWordsFromUpload parses excel uploads", () => {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([["Tree"], ["tree"], ["Rock"]]);
    xlsx.utils.book_append_sheet(workbook, sheet, "Sheet1");
    const buffer = xlsx.write(workbook, { bookType: "xlsx", type: "buffer" });

    const file = {
      mimetype:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    };

    const result = parseUniqueWordsFromUpload(file);
    expect(result).toEqual(["tree", "rock"]);
  });

  it("parseUniqueWordsFromUpload throws for unsupported mime type", () => {
    const file = {
      mimetype: "application/json",
      buffer: Buffer.from("{}", "utf-8"),
    };

    expect(() => parseUniqueWordsFromUpload(file)).toThrow(
      "Unsupported file type"
    );
  });
});
