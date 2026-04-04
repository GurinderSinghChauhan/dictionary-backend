import mongoose from "mongoose";
import words from "../../models/words";
import { escapeRegex, getPositiveInteger } from "../../utils/text";

// Fetch all words with pagination and optional search
export async function getAllWords({
  page = 1,
  limit = 10,
  search = "",
}: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("Database connection unavailable");
  }

  const safePage = getPositiveInteger(page, 1);
  const safeLimit = getPositiveInteger(limit, 10);
  const skip = (safePage - 1) * safeLimit;
  const query = search
    ? { word: { $regex: new RegExp(escapeRegex(search), "i") } }
    : {};

  const [wordDocs, total] = await Promise.all([
    words
      .find(query, {
        word: 1,
        exampleSentence: 1,
        positivePrompt: 1,
        imageURL: 1,
        _id: 0,
        promptId: 1,
        meaning: 1,
      })
      .lean()
      .skip(skip)
      .limit(safeLimit)
      .sort({ word: 1 }),
    words.countDocuments(query),
  ]);

  return {
    words: wordDocs,
    total,
    page: safePage,
    totalPages: Math.ceil(total / safeLimit),
  };
}

// Delete a word by its text value
export async function deleteWord(word: string) {
  const deleted = await words.findOneAndDelete({ word });
  return !!deleted;
}
