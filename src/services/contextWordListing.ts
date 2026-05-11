import WordSense from "../models/wordSense";

type ContextType = "subject" | "grade" | "exam";

type ContextWordSense = {
  word: string;
  partOfSpeech?: string;
  pronunciation?: string;
  wordForms?: string[];
  meaning: string;
  shortDefinition?: string;
  exampleSentence?: string;
  synonyms?: string[];
  antonyms?: string[];
  memoryTrick?: string;
  origin?: string;
  senseId: string;
  image?: {
    url?: string;
  };
};

const toFrontendWord = (item: ContextWordSense) => ({
  word: item.word,
  partOfSpeech: item.partOfSpeech || "",
  pronunciation: item.pronunciation || "",
  wordForms: item.wordForms || [],
  meaning: item.meaning,
  shortDefinition: item.shortDefinition || "",
  exampleSentence: item.exampleSentence || "",
  synonyms: item.synonyms || [],
  antonyms: item.antonyms || [],
  memoryTrick: item.memoryTrick || "",
  origin: item.origin || "",
  imageURL: item.image?.url || "",
  senseId: item.senseId,
});

export async function getContextWords(
  contextType: ContextType,
  contextValue: string,
  page: number,
  limit: number
) {
  if (!contextValue) {
    throw new Error(
      `${contextType.charAt(0).toUpperCase() + contextType.slice(1)} is required.`
    );
  }

  const normalizedContextValue = contextValue.trim().toLowerCase();
  const startIndex = (page - 1) * limit;

  const senseMatches = await WordSense.find({
    status: "active",
    contexts: {
      $elemMatch: {
        type: contextType,
        key: normalizedContextValue,
      },
    },
  })
    .sort({ normalizedWord: 1, senseId: 1 })
    .lean();

  if (senseMatches.length > 0) {
    const paginatedWords = senseMatches
      .slice(startIndex, startIndex + limit)
      .map((item) => toFrontendWord(item as unknown as ContextWordSense));

    return {
      [contextType]: contextValue,
      totalWords: senseMatches.length,
      page,
      totalPages: Math.ceil(senseMatches.length / limit),
      words: paginatedWords,
      source: "word_senses" as const,
    };
  }

  throw new Error(
    `${contextType.charAt(0).toUpperCase() + contextType.slice(1)} not found.`
  );
}
