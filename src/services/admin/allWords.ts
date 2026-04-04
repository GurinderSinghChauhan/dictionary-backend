import words from "../../models/words";

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
  const skip = (page - 1) * limit;
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
      }) // select specific fields
      .skip(skip)
      .limit(limit)
      .sort({ word: 1 }),
    words.countDocuments(query),
  ]);

  return {
    wordsArray: wordDocs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// Delete a word by its text value
export async function deleteWord(word: string) {
  const deleted = await words.findOneAndDelete({ word });
  return !!deleted;
}
