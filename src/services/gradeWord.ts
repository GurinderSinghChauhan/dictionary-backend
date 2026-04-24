import { ensureWordForms, inferWordForms, WordDetails } from "./wordServices";
import WordSense from "../models/wordSense";
import { getOpenAIClient } from "./openaiClient";
import { logger } from "../utils/logger";
import { normalizeWordList } from "../utils/text";
import { upsertWordSense } from "./wordSensePersistence";
import { getContextWords } from "./contextWordListing";

export const uploadGradeWords = async (grade: string, wordList: string[]) => {
  try {
    const cleanedWords = normalizeWordList(wordList);
    const normalizedGrade = grade.trim().toLowerCase();
    const existingSenses = await WordSense.find({
      normalizedWord: { $in: cleanedWords },
      contexts: {
        $elemMatch: {
          type: "grade",
          key: normalizedGrade,
        },
      },
      status: "active",
    }).lean();
    const existingWords = new Set(
      existingSenses.map((sense) => String(sense.normalizedWord).toLowerCase())
    );

    const results = [];

    for (const term of cleanedWords) {
      logger.info("Processing grade term", { grade, term });
      const existingWord = existingWords.has(term);

      if (!existingWord) {
        const wordDetails = await getWordDetailsInContext(term, grade);
        if (!wordDetails) {
          results.push({ term, error: "Word details could not be fetched." });
          continue;
        }
        await upsertWordSense(term, wordDetails, "grade", grade);

        const newWord = {
          ...wordDetails,
          word: wordDetails.word.toLowerCase(),
          promptId: "",
        };
        results.push({
          term,
          result: { word: newWord.word, prompt: wordDetails.positivePrompt },
        });

        continue;
      }

      results.push({
        term,
        result: { word: term },
      });
    }

    return {
      success: true,
      grade,
      data: results,
    };
  } catch (error) {
    logger.error("Error uploading grade words", error);
    throw error;
  }
};

async function getWordDetailsInContext(word: string, context: string) {
  const openai = getOpenAIClient();
  const isGrade = context.toLowerCase().startsWith("grade");
  const contextPrompt = isGrade
    ? `The word '${word}' is used in the learning context of '${context}', which refers to a school grade level.`
    : `The word '${word}' is used in the context of the grade '${context}'.`;

  const prompt = `
    ${contextPrompt}
    Provide a detailed dictionary-style breakdown of the word: "${word}" in this context.
  
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
    - Write a vivid, photorealistic image description that captures the core meaning and essence of the word.
    - Make it highly visual, detailed, and rooted in the subject or grade context.
    - Describe the scene, objects, mood, setting, lighting, and action.
    - Make it easy for an AI model to generate a meaningful image directly from the prompt.
  
    For example, if the word is "eruption", the positivePrompt could be:
    "A powerful volcanic eruption with lava spewing into the sky, dark smoke clouds, red-hot molten rocks, and villagers watching from a safe distance — dramatic lighting, National Geographic style."
  
    For "wordForms", return a non-empty list whenever ordinary forms exist:
    verbs should include third-person, past tense, and -ing forms; nouns should
    include plural forms; adjectives should include comparative/superlative or
    closely related forms.

    For "memoryTrick", write it in a way that helps the reader easily remember
    the meaning of the word. Use a short learner-friendly mnemonic,
    sound-alike cue, visual association, or word-part connection that points
    toward the meaning. Do not merely restate the definition.
  
    Format strictly as valid JSON with double quotes and all fields present.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0].message.content || "";

  try {
    const data: WordDetails = JSON.parse(text);
    return ensureWordForms(data, word);
  } catch (err) {
    logger.error("Failed to parse grade word JSON response", err);
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

export const getGradeWords = async (
  grade: string,
  page: number,
  limit: number
) => {
  return getContextWords("grade", grade, page, limit);
};
