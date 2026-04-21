import words from "../../models/words";
import { getWordDetails } from "../wordServices";
import { normalizeWord } from "../../utils/text";

export const defineManyWords = async (wordArray: string[]) => {
  if (!Array.isArray(wordArray) || wordArray.length === 0) {
    throw new Error("Please provide a non-empty array of words.");
  }

  const results = [];

  for (const termRaw of wordArray) {
    const term = normalizeWord(termRaw);
    const existing = await words.findOne({ word: term });

    if (existing) {
      results.push({ term, result: { word: existing.word } });
      continue;
    }

    const wordData = await getWordDetails(term);
    wordData.word = term;
    wordData.promptId = "";

    const savedWord = await words.create(wordData);
    results.push({ term, result: { word: savedWord.word } });
  }

  return { success: true, data: results };
};
