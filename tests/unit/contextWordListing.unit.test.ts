import { beforeEach, describe, expect, it, vi } from "vitest";

const wordSenseFind = vi.fn();
vi.mock("../../src/models/wordSense", () => ({
  default: {
    find: wordSenseFind,
  },
}));

const { getContextWords } = await import(
  "../../src/services/contextWordListing"
);

describe("getContextWords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers word_senses for contextual reads", async () => {
    wordSenseFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            word: "cell",
            meaning: "the basic structural and functional unit of life",
            senseId: "cell-noun-subject-biology",
            partOfSpeech: "noun",
            pronunciation: "sel",
            wordForms: ["cells"],
            exampleSentence: "A cell contains organelles.",
            synonyms: ["unit"],
            antonyms: [],
            memoryTrick: "Cell is a small unit.",
            origin: "From Latin cella.",
            image: { url: "https://example.com/cell.png" },
          },
        ]),
      }),
    });

    const result = await getContextWords("subject", "biology", 1, 10);

    expect(result.source).toBe("word_senses");
    expect(result.subject).toBe("biology");
    expect(result.totalWords).toBe(1);
    expect(result.words[0]).toEqual({
      word: "cell",
      meaning: "the basic structural and functional unit of life",
      senseId: "cell-noun-subject-biology",
      partOfSpeech: "noun",
      pronunciation: "sel",
      wordForms: ["cells"],
      shortDefinition: "",
      exampleSentence: "A cell contains organelles.",
      synonyms: ["unit"],
      antonyms: [],
      memoryTrick: "Cell is a small unit.",
      origin: "From Latin cella.",
      imageURL: "https://example.com/cell.png",
    });
  });

  it("throws not found when no contextual senses exist", async () => {
    wordSenseFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    });

    await expect(getContextWords("subject", "biology", 1, 10)).rejects.toThrow(
      "Subject not found."
    );
  });
});
