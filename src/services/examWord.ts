import WordSense from "../models/wordSense";
import { ensureWordForms, WordDetails } from "./wordServices";
import { getOpenAIClient } from "./openaiClient";
import { logger } from "../utils/logger";
import { normalizeWordList } from "../utils/text";
import { upsertWordSense } from "./wordSensePersistence";
import { getContextWords } from "./contextWordListing";

export const uploadExamWords = async (exam: string, wordList: string[]) => {
  try {
    const cleanedWords = normalizeWordList(wordList);
    const normalizedExam = exam.trim().toLowerCase();
    const existingSenses = await WordSense.find({
      normalizedWord: { $in: cleanedWords },
      contexts: {
        $elemMatch: {
          type: "exam",
          key: normalizedExam,
        },
      },
      status: "active",
    }).lean();
    const existingWords = new Set(
      existingSenses.map((sense) => String(sense.normalizedWord).toLowerCase())
    );

    const results = [];

    for (const term of cleanedWords) {
      const existingWord = existingWords.has(term);

      if (!existingWord) {
        const wordDetails = await getWordDetailsInContext(term, exam);
        if (!wordDetails) {
          results.push({ term, error: "Word details could not be fetched." });
          continue;
        }
        await upsertWordSense(term, wordDetails, "exam", exam);

        const newWord = {
          ...wordDetails,
          word: wordDetails.word.toLowerCase(),
          promptId: "",
        };

        results.push({ term, result: { word: newWord.word } });
        continue;
      }

      results.push({
        term,
        result: { word: term },
      });
    }
    return { success: true, exam, data: results };
  } catch (err) {
    logger.error("Error uploading exam words", err);
    throw err;
  }
};

async function getWordDetailsInContext(word: string, context: string) {
  const openai = getOpenAIClient();
  const prompt = `
    The word '${word}' is used in the context of '${context}'.
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

    For "wordForms", return a non-empty list whenever ordinary forms exist:
    verbs should include third-person, past tense, and -ing forms; nouns should
    include plural forms; adjectives should include comparative/superlative or
    closely related forms.

    For "memoryTrick", write it in a way that helps the reader easily remember
    the meaning of the word. Use a short learner-friendly mnemonic,
    sound-alike cue, visual association, or word-part connection that points
    toward the meaning. Do not merely restate the definition.

    Format strictly as valid JSON with double quotes, and all fields present.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const data: WordDetails = JSON.parse(
      response.choices[0].message.content || "{}"
    );
    return ensureWordForms(data, word);
  } catch (err) {
    logger.error("Failed to parse exam word JSON response", err);
    return null;
  }
}

export const getExamWords = async (
  exam: string,
  page: number,
  limit: number
) => {
  return getContextWords("exam", exam, page, limit);
};
