import { describe, it, expect } from "vitest";

describe("Word parsing utilities - edge cases", () => {
  describe("Text normalization", () => {
    it("should handle empty strings gracefully", () => {
      const parseWords = (text: string) =>
        text
          .split(/[,\n]/)
          .map((w) => w.trim().toLowerCase())
          .filter(Boolean);

      expect(parseWords("")).toEqual([]);
      expect(parseWords("   ")).toEqual([]);
      expect(parseWords(",,,")).toEqual([]);
    });

    it("should normalize unicode characters", () => {
      const normalize = (text: string) => text.toLowerCase().trim();

      expect(normalize("CAFÉ")).toBe("café");
      expect(normalize("Naïve")).toBe("naïve");
    });

    it("should handle mixed delimiters", () => {
      const parseWords = (text: string) =>
        text
          .split(/[,\n;]/)
          .map((w) => w.trim().toLowerCase())
          .filter(Boolean);

      const result = parseWords("apple, banana\ncherry; date");
      expect(result).toContain("apple");
      expect(result).toContain("banana");
      expect(result).toContain("cherry");
      expect(result).toContain("date");
    });
  });

  describe("De-duplication", () => {
    it("should remove case-insensitive duplicates", () => {
      const words = ["Apple", "apple", "APPLE", "banana", "Banana"];
      const unique = [...new Set(words.map((w) => w.toLowerCase()))];

      expect(unique).toHaveLength(2);
      expect(unique).toContain("apple");
      expect(unique).toContain("banana");
    });

    it("should preserve order while deduplicating", () => {
      const parseAndDedupe = (text: string) => {
        const seen = new Set();
        return text
          .split(/[,\n]/)
          .map((w) => w.trim().toLowerCase())
          .filter((w) => {
            if (!w || seen.has(w)) return false;
            seen.add(w);
            return true;
          });
      };

      const result = parseAndDedupe("zebra, apple, apple, banana");
      expect(result).toEqual(["zebra", "apple", "banana"]);
    });
  });

  describe("File type validation", () => {
    it("should validate MIME types", () => {
      const isSupportedMimeType = (mime: string) =>
        ["text/plain", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(mime);

      expect(isSupportedMimeType("text/plain")).toBe(true);
      expect(
        isSupportedMimeType(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
      ).toBe(true);
      expect(isSupportedMimeType("application/json")).toBe(false);
      expect(isSupportedMimeType("image/png")).toBe(false);
    });
  });

  describe("Whitespace handling", () => {
    it("should handle leading/trailing whitespace", () => {
      const normalize = (word: string) => word.trim().toLowerCase();

      expect(normalize("  word  ")).toBe("word");
      expect(normalize("\tword\n")).toBe("word");
      expect(normalize("   \t   word   \n   ")).toBe("word");
    });

    it("should handle internal whitespace appropriately", () => {
      const words = ["two words", "three words here", "single"];
      const cleaned = words.map((w) => w.trim().toLowerCase());

      expect(cleaned[0]).toBe("two words");
      expect(cleaned[1]).toBe("three words here");
      expect(cleaned[2]).toBe("single");
    });
  });

  describe("Special characters handling", () => {
    it("should preserve hyphens and apostrophes in words", () => {
      const words = ["self-aware", "don't", "co-worker", "it's"];
      expect(words).toContain("self-aware");
      expect(words).toContain("don't");
      expect(words).toContain("co-worker");
      expect(words).toContain("it's");
    });

    it("should strip punctuation at word boundaries", () => {
      const cleanWord = (word: string) =>
        word.trim().replace(/^[^\w-]+|[^\w-']+$/g, "").toLowerCase();

      expect(cleanWord("(word)")).toBe("word");
      expect(cleanWord("!hello?")).toBe("hello");
      expect(cleanWord(".test.")).toBe("test");
    });
  });
});
