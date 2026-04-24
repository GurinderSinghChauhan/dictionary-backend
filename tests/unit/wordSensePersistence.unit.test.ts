import { beforeEach, describe, expect, it, vi } from "vitest";

const wordFindOne = vi.fn();
const wordUpdateOne = vi.fn();
const wordCreate = vi.fn();
const wordSenseUpdateOne = vi.fn();

vi.mock("../../src/models/words", () => ({
  default: {
    findOne: wordFindOne,
    updateOne: wordUpdateOne,
    create: wordCreate,
  },
}));

vi.mock("../../src/models/wordSense", () => ({
  default: {
    updateOne: wordSenseUpdateOne,
  },
}));

const { upsertWordSense } = await import(
  "../../src/services/wordSensePersistence"
);

describe("upsertWordSense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a base word when missing and upserts a subject sense", async () => {
    wordFindOne.mockResolvedValue(null);
    wordCreate.mockResolvedValue({ _id: "word-1" });
    wordSenseUpdateOne.mockResolvedValue({ acknowledged: true });

    await upsertWordSense(
      "Cell",
      {
        word: "cell",
        partOfSpeech: "noun",
        pronunciation: "sel",
        wordForms: ["cells"],
        meaning: "the basic structural and functional unit of life",
        exampleSentence: "A cell contains genetic material.",
        synonyms: ["unit"],
        antonyms: [],
        memoryTrick: "Think of a tiny life room. A cell is the basic unit of life.",
        origin: "From Latin cella.",
        positivePrompt: "biology cell",
        negativePrompt: "blurry",
      },
      "subject",
      "Biology"
    );

    expect(wordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        word: "cell",
        partOfSpeech: "noun",
        meaning: "the basic structural and functional unit of life",
      })
    );

    expect(wordSenseUpdateOne).toHaveBeenCalledWith(
      { senseId: "cell-noun-subject-biology" },
      expect.objectContaining({
        $set: expect.objectContaining({
          wordId: "word-1",
          word: "cell",
          normalizedWord: "cell",
          contexts: [
            {
              type: "subject",
              key: "biology",
              priority: 10,
            },
          ],
          searchText: expect.stringContaining("cell"),
        }),
      }),
      { upsert: true }
    );
  });

  it("reuses an existing base word and only patches empty lexical fields", async () => {
    wordFindOne.mockResolvedValue({
      _id: "word-2",
      partOfSpeech: "",
      pronunciation: "",
      wordForms: [],
      origin: "",
    });
    wordSenseUpdateOne.mockResolvedValue({ acknowledged: true });

    await upsertWordSense(
      "Cell",
      {
        word: "cell",
        partOfSpeech: "noun",
        pronunciation: "sel",
        wordForms: ["cells"],
        meaning: "the basic structural and functional unit of life",
        exampleSentence: "",
        synonyms: [],
        antonyms: [],
        memoryTrick: "",
        origin: "From Latin cella.",
        positivePrompt: "",
        negativePrompt: "",
      },
      "subject",
      "Biology"
    );

    expect(wordCreate).not.toHaveBeenCalled();
    expect(wordUpdateOne).toHaveBeenCalledWith(
      { _id: "word-2" },
      {
        $set: {
          partOfSpeech: "noun",
          pronunciation: "sel",
          wordForms: ["cells"],
          origin: "From Latin cella.",
        },
      }
    );
    expect(wordSenseUpdateOne).toHaveBeenCalledOnce();
  });
});
