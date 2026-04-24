import { beforeEach, describe, expect, it, vi } from "vitest";

const wordFindOne = vi.fn();
const wordSenseFindOne = vi.fn();
const getWordDetails = vi.fn();
const upsertWordSense = vi.fn();

vi.mock("../../src/models/words", () => ({
  default: {
    findOne: wordFindOne,
  },
}));

vi.mock("../../src/models/wordSense", () => ({
  default: {
    findOne: wordSenseFindOne,
  },
}));

vi.mock("../../src/services/wordServices", () => ({
  getWordDetails,
}));

vi.mock("../../src/services/wordSensePersistence", () => ({
  upsertWordSense,
}));

const { defineManyWords } = await import(
  "../../src/services/admin/wordDefinition"
);

describe("defineManyWords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a generic sense for a new word", async () => {
    wordFindOne.mockResolvedValue(null);
    getWordDetails.mockResolvedValue({
      word: "cell",
      partOfSpeech: "noun",
      pronunciation: "sel",
      wordForms: ["cells"],
      meaning: "basic unit of life",
      exampleSentence: "",
      synonyms: [],
      antonyms: [],
      memoryTrick: "",
      origin: "",
      positivePrompt: "",
      negativePrompt: "",
      promptId: "",
    });

    const result = await defineManyWords(["cell"]);

    expect(upsertWordSense).toHaveBeenCalledWith(
      "cell",
      expect.objectContaining({ word: "cell", meaning: "basic unit of life" }),
      "generic",
      ""
    );
    expect(result).toEqual({
      success: true,
      data: [{ term: "cell", result: { word: "cell" } }],
    });
  });

  it("backfills a missing generic sense for an existing base word", async () => {
    wordFindOne.mockResolvedValue({
      word: "cell",
      partOfSpeech: "noun",
      pronunciation: "sel",
      wordForms: ["cells"],
      meaning: "legacy meaning",
      exampleSentence: "",
      synonyms: [],
      antonyms: [],
      memoryTrick: "",
      origin: "",
      positivePrompt: "",
      negativePrompt: "",
      imageURL: "https://example.com/cell.png",
      promptId: "",
      toObject() {
        return {
          word: this.word,
          partOfSpeech: this.partOfSpeech,
          pronunciation: this.pronunciation,
          wordForms: this.wordForms,
          meaning: this.meaning,
          exampleSentence: this.exampleSentence,
          synonyms: this.synonyms,
          antonyms: this.antonyms,
          memoryTrick: this.memoryTrick,
          origin: this.origin,
          positivePrompt: this.positivePrompt,
          negativePrompt: this.negativePrompt,
          imageURL: this.imageURL,
          promptId: this.promptId,
        };
      },
    });
    wordSenseFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const result = await defineManyWords(["cell"]);

    expect(wordSenseFindOne).toHaveBeenCalled();
    expect(upsertWordSense).toHaveBeenCalledWith(
      "cell",
      expect.objectContaining({
        word: "cell",
        meaning: "legacy meaning",
        imageURL: "https://example.com/cell.png",
      }),
      "generic",
      ""
    );
    expect(result).toEqual({
      success: true,
      data: [{ term: "cell", result: { word: "cell" } }],
    });
  });
});
