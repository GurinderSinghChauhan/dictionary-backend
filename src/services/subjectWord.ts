// controllers/subject.ts
import SubjectWords from "../models/subjectWords";
import { ensureWordForms, inferWordForms, WordDetails } from "./wordServices";
import { getOpenAIClient } from "./openaiClient";
import { logger } from "../utils/logger";
import { escapeRegex, normalizeWordList } from "../utils/text";

const getSubjectContext = (subject: string) => {
  const normalized = subject.toLowerCase();
  if (normalized === "english") {
    return "English literature";
  }
  if (normalized === "political") {
    return "Political science";
  }
  return subject;
};

// Add or update words for a subject
export const addSubjectWords = async (subject: string, words: unknown[]) => {
  try {
    if (!subject || !Array.isArray(words) || words.length === 0) {
      throw new Error("Subject and words array are required.");
    }

    return await SubjectWords.findOneAndUpdate(
      { subject: new RegExp(`^${escapeRegex(subject)}$`, "i") },
      { $set: { subject }, $push: { words: { $each: words } } },
      { new: true, upsert: true }
    );
  } catch (err) {
    logger.error("Error adding subject words", err);
    throw err;
  }
};

// Get subject words with their meaning
// export const getSubjectWords = async (
//   subject: string,
//   page: number,
//   limit: number
// ) => {
//   if (!subject) {
//     throw new Error("Subject is required.");
//   }

//   const result = await SubjectWords.findOne({
//     subject: new RegExp(`^${subject}$`, "i"),
//   });

//   if (!result) {
//     throw new Error("Subject not found.");
//   }

//   const startIndex = (page - 1) * limit;
//   const paginatedWords = result.words.slice(startIndex, startIndex + limit);

//   return {
//     subject: result.subject,
//     totalWords: result.words.length,
//     page,
//     totalPages: Math.ceil(result.words.length / limit),
//     words: paginatedWords,
//   };
// };

export const uploadSubjectWords = async (
  subject: string,
  wordList: string[]
) => {
  try {
    const cleanedWords = normalizeWordList(wordList);

    // Get existing words for the subject
    const existingEntry = await SubjectWords.findOne({
      subject: new RegExp(`^${escapeRegex(subject)}$`, "i"),
    });

    const existingWords = new Set<string>(
      (existingEntry?.words || []).map((w: any) => w.word.toLowerCase())
    );

    const addedWords: any[] = [];
    const skippedWords: string[] = [];

    for (const word of cleanedWords) {
      if (existingWords.has(word)) {
        skippedWords.push(word);
      } else {
        // Handle special subject names for better context
        const wordDetails = await getWordDetailsInContext(
          word,
          getSubjectContext(subject)
        );
        addedWords.push(wordDetails);
      }
    }
    // Insert only new words
    const updated = await SubjectWords.findOneAndUpdate(
      { subject: new RegExp(`^${escapeRegex(subject)}$`, "i") },
      { $set: { subject }, $push: { words: { $each: addedWords } } },
      { new: true, upsert: true }
    );

    return {
      updated,
      addedWords: addedWords.map((w) => w.word),
      skippedWords,
    };
  } catch (err) {
    logger.error("Error uploading subject words", err);
    throw err;
  }
};

async function getWordDetailsInContext(word: string, subject: string) {
  const openai = getOpenAIClient();
  const subjectPrompt = `The word '${word}' is used in the context of the subject '${subject}'.`;

  const prompt = `
    ${subjectPrompt}
    Provide a detailed dictionary-style breakdown of the word: "${word}" in the context of '${subject}'.

    Format your response as a valid JSON object with these exact keys:

    {
      "word": string,
      "partOfSpeech": string,
      "pronunciation": string,
      "wordForms": string[],
      "meaning": string,
      "exampleSentence": string,
      "synonyms": string[],
      "antonyms": string[],
      "memoryTrick": string,
      "origin": string,
      "positivePrompt": string,
      "negativePrompt": string
    }

    Instructions for "positivePrompt":
    - Describe a vivid, photorealistic real-world scene that visually conveys the meaning of the word in the '${subject}' context.
    - Mention setting, environment, lighting, mood, and objects involved.
    - The goal is to create a visual prompt suitable for generating an accurate, detailed picture of the word in action.
    - Avoid abstract explanations — think of how the word would look visually in real life or in a story-based educational scene.

    Example: For the word "pollination" in the context of biology, the positivePrompt could be:
    "A close-up shot of a honeybee landing on a vibrant yellow sunflower, collecting pollen, with fine pollen particles visible on its legs, under bright morning sunlight — realistic botanical detail, shallow depth of field."

    For "wordForms", return a non-empty list whenever ordinary forms exist:
    verbs should include third-person, past tense, and -ing forms; nouns should
    include plural forms; adjectives should include comparative/superlative or
    closely related forms.

    For "memoryTrick", do not use the definition as the trick. Use a short
    mnemonic, sound-alike cue, visual association, or word-part connection that
    helps a learner remember the word.

    Format strictly as valid JSON with double quotes and include all keys, even if some values are empty.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0].message.content || "";

  try {
    // Parse the entire response as JSON
    const data: WordDetails = JSON.parse(text);
    return ensureWordForms(data, word);
  } catch (err) {
    logger.error("Failed to parse subject word JSON response", err);
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

export const getSubjectWords = async (
  subject: string,
  page: number,
  limit: number
) => {
  if (!subject) throw new Error("Subject is required.");

  const result = await SubjectWords.findOne({
    subject: new RegExp(`^${escapeRegex(subject)}$`, "i"),
  });

  if (!result) throw new Error("Subject not found.");

  const startIndex = (page - 1) * limit;

  // Just return word + meaning
  const paginatedWords = result.words
    .slice(startIndex, startIndex + limit)
    .map((item: any) => ({
      word: item.word,
      meaning: item.meaning,
    }));

  return {
    subject: result.subject,
    totalWords: result.words.length,
    page,
    totalPages: Math.ceil(result.words.length / limit),
    words: paginatedWords, // simplified array
  };
};
