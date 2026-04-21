import { getOpenAIClient } from "./openaiClient";
import { logger } from "../utils/logger";

export interface WordDetails {
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  wordForms: string[];
  meaning: string;
  exampleSentence: string;
  synonyms: string[];
  antonyms: string[];
  memoryTrick: string;
  origin: string;
  positivePrompt: string;
  negativePrompt: string;
  promptId?: string;
}

const hasWordForms = (value: unknown): value is string[] =>
  Array.isArray(value) && value.some((item) => String(item).trim());

const pluralize = (word: string) => {
  if (word.endsWith("y") && !/[aeiou]y$/i.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }

  if (/(s|x|z|ch|sh)$/i.test(word)) {
    return `${word}es`;
  }

  return `${word}s`;
};

const pastTense = (word: string) => {
  if (word.endsWith("e")) {
    return `${word}d`;
  }

  if (word.endsWith("y") && !/[aeiou]y$/i.test(word)) {
    return `${word.slice(0, -1)}ied`;
  }

  return `${word}ed`;
};

const presentParticiple = (word: string) => {
  if (word.endsWith("ie")) {
    return `${word.slice(0, -2)}ying`;
  }

  if (word.endsWith("e") && !/(ee|oe|ye)$/i.test(word)) {
    return `${word.slice(0, -1)}ing`;
  }

  return `${word}ing`;
};

export const inferWordForms = (word: string, partOfSpeech = ""): string[] => {
  const normalizedWord = word.trim().toLowerCase();
  const normalizedPartOfSpeech = partOfSpeech.toLowerCase();

  if (!normalizedWord) {
    return [];
  }

  if (normalizedPartOfSpeech.includes("verb")) {
    return [
      pluralize(normalizedWord),
      pastTense(normalizedWord),
      presentParticiple(normalizedWord),
    ];
  }

  if (normalizedPartOfSpeech.includes("noun")) {
    return [pluralize(normalizedWord)];
  }

  if (normalizedPartOfSpeech.includes("adjective")) {
    return [`more ${normalizedWord}`, `most ${normalizedWord}`];
  }

  return [];
};

export const ensureWordForms = <T extends Partial<WordDetails>>(
  details: T,
  fallbackWord: string
): T => {
  if (hasWordForms(details.wordForms)) {
    details.wordForms = details.wordForms
      .map((item) => String(item).trim())
      .filter(Boolean);
    return details;
  }

  details.wordForms = inferWordForms(
    String(details.word || fallbackWord),
    details.partOfSpeech
  );
  return details;
};

export async function getWordDetails(word: string): Promise<WordDetails> {
  const openai = getOpenAIClient();
  const prompt = `
    Provide a detailed dictionary-style breakdown of the word: "${word}". 
    Format your response as a valid JSON object with the following keys exactly:

    {
        "word": string,                // The word itself
        "partOfSpeech": string,        // Part of speech
        "pronunciation": string,       // IPA notation if possible
        "wordForms": string[],         // Non-empty list of inflected or derived forms; for verbs include third-person, past tense, and -ing forms; for nouns include plural forms; for adjectives include comparative/superlative or closely related forms
        "meaning": string,             // The most accurate meaning / definition
        "exampleSentence": string,     // Example sentence using the word
        "synonyms": string[],          // List of 3 to 5 synonyms
        "antonyms": string[],          // List of antonyms (if available)
        "memoryTrick": string,         // A memory trick or way to remember the word
        "origin": string,              // Short origin story or etymology
        "positivePrompt": string,      // A vivid, photorealistic image prompt related to the word, capturing the core meaning in a real-world scene
        "negativePrompt": string       // Things to avoid in the image: low quality, unrealistic render, cartoonish style, deformed shapes, AI artifacts
    }

    Make sure the JSON is correctly formatted with double quotes, no extra text outside the JSON object, and all keys are present. Do not leave wordForms empty when ordinary inflected or derived forms exist.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0].message.content || "";

  try {
    // Parse the entire response as JSON
    const data: WordDetails = JSON.parse(text);
    return ensureWordForms(data, word) as WordDetails;
  } catch (err) {
    logger.error("Failed to parse word details JSON response", err);
    // Return fallback with some defaults, or throw error as needed
    return {
      word,
      partOfSpeech: "",
      pronunciation: "",
      wordForms: inferWordForms(word),
      meaning: "",
      exampleSentence: "",
      synonyms: [],
      antonyms: [],
      memoryTrick: "",
      origin: "",
      positivePrompt: "",
      negativePrompt: "",
    };
  }
}
