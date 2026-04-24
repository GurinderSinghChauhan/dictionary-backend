// controllers/subject.ts
import WordSense from "../models/wordSense";
import { ensureWordForms, inferWordForms, WordDetails } from "./wordServices";
import { getOpenAIClient } from "./openaiClient";
import { logger } from "../utils/logger";
import { normalizeWordList } from "../utils/text";
import { upsertWordSense } from "./wordSensePersistence";
import { getContextWords } from "./contextWordListing";

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
    const normalizedSubject = subject.trim().toLowerCase();

    for (const item of words as WordDetails[]) {
      await upsertWordSense(item.word, item, "subject", normalizedSubject);
    }

    return {
      subject,
      addedWords: (words as WordDetails[]).map((item) => item.word),
    };
  } catch (err) {
    logger.error("Error adding subject words", err);
    throw err;
  }
};

export const uploadSubjectWords = async (
  subject: string,
  wordList: string[]
) => {
  try {
    const cleanedWords = normalizeWordList(wordList);
    const normalizedSubject = subject.trim().toLowerCase();
    const existingSenses = await WordSense.find({
      normalizedWord: { $in: cleanedWords },
      contexts: {
        $elemMatch: {
          type: "subject",
          key: normalizedSubject,
        },
      },
      status: "active",
    }).lean();
    const existingWords = new Set<string>(
      existingSenses.map((sense) => String(sense.normalizedWord).toLowerCase())
    );

    const addedWords: string[] = [];
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
        await upsertWordSense(word, wordDetails, "subject", subject);
        addedWords.push(wordDetails.word.toLowerCase());
      }
    }

    return {
      updated: null,
      subject,
      addedWords,
      skippedWords,
      source: "word_senses" as const,
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

    For "memoryTrick", write it in a way that helps the reader easily remember
    the meaning of the word. Use a short learner-friendly mnemonic,
    sound-alike cue, visual association, or word-part connection that points
    toward the meaning. Do not merely restate the definition.

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
  return getContextWords("subject", subject, page, limit);
};
