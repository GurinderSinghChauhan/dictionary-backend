import { beforeEach, describe, expect, it, vi } from "vitest";

const wordSenseFind = vi.fn();
const wordFindOne = vi.fn();

vi.mock("../../src/models/wordSense", () => ({
  default: {
    find: wordSenseFind,
  },
}));

vi.mock("../../src/models/words", () => ({
  default: {
    findOne: wordFindOne,
  },
}));

const { lookupWord } = await import("../../src/services/wordLookup");

describe("lookupWord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns context-matched senses from word_senses", async () => {
    wordSenseFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          normalizedWord: "cell",
          meaning: "the basic structural and functional unit of life",
          contexts: [{ type: "subject", key: "biology", priority: 10 }],
          image: { url: "https://example.com/biology-cell.png" },
        },
        {
          normalizedWord: "cell",
          meaning: "a small room in a prison",
          contexts: [{ type: "generic", key: "", priority: 100 }],
          image: { url: "https://example.com/prison-cell.png" },
        },
      ]),
    });

    const result = await lookupWord("cell", {
      contextType: "subject",
      contextKey: "biology",
    });

    expect(result?.source).toBe("word_senses");
    expect(result?.totalSenses).toBe(1);
    expect(result?.result.meaning).toContain("unit of life");
    expect(result?.result.imageURL).toBe(
      "https://example.com/biology-cell.png"
    );
    expect(result?.senses).toHaveLength(1);
    expect(result?.requestedContext).toEqual({
      type: "subject",
      key: "biology",
    });
    expect(wordFindOne).not.toHaveBeenCalled();
  });

  it("falls back to legacy words when no sense records exist", async () => {
    wordSenseFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });
    wordFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        word: "cell",
        meaning: "a small room in a prison",
        promptId: "",
      }),
    });

    const result = await lookupWord("cell");

    expect(result?.source).toBe("words");
    expect(result?.totalSenses).toBe(1);
    expect(result?.result.word).toBe("cell");
    expect(result?.senses).toHaveLength(1);
  });
});
