import { getWordDetails } from "../wordServices";
import { normalizeWord } from "../../utils/text";
import words from "../../models/words";
import { upsertWordSense } from "../wordSensePersistence";
import WordSense from "../../models/wordSense";

export const defineManyWords = async (wordArray: string[]) => {
  if (!Array.isArray(wordArray) || wordArray.length === 0) {
    throw new Error("Please provide a non-empty array of words.");
  }

  const results = [];

  for (const termRaw of wordArray) {
    const term = normalizeWord(termRaw);
    const existing = await words.findOne({ word: term });

    if (existing) {
      const existingGenericSense = await WordSense.findOne({
        normalizedWord: term,
        contexts: {
          $elemMatch: {
            type: "generic",
            key: "",
          },
        },
        status: "active",
      }).lean();

      if (!existingGenericSense) {
        await upsertWordSense(
          term,
          {
            ...existing.toObject(),
            word: term,
          },
          "generic",
          ""
        );
      }

      results.push({ term, result: { word: existing.word } });
      continue;
    }

    const wordData = await getWordDetails(term);
    wordData.word = term;
    wordData.promptId = "";
    await upsertWordSense(term, wordData, "generic", "");
    results.push({ term, result: { word: term } });
  }

  return { success: true, data: results };
};
