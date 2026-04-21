import ExamWords from "../models/examWords";
import { ensureWordForms, WordDetails } from "./wordServices";
import { getOpenAIClient } from "./openaiClient";
import { logger } from "../utils/logger";
import { escapeRegex, normalizeWordList } from "../utils/text";

export const uploadExamWords = async (exam: string, wordList: string[]) => {
  try {
    const cleanedWords = normalizeWordList(wordList);

    let examEntry = await ExamWords.findOne({
      exam: new RegExp(`^${escapeRegex(exam)}$`, "i"),
    });

    if (!examEntry) {
      examEntry = new ExamWords({ exam, words: [] });
    }

    const results = [];

    for (const term of cleanedWords) {
      const existingWord = examEntry.words.find(
        (w: any) => w.word.toLowerCase() === term
      );

      if (!existingWord) {
        const wordDetails = await getWordDetailsInContext(term, exam);
        if (!wordDetails) {
          results.push({ term, error: "Word details could not be fetched." });
          continue;
        }

        const newWord = {
          ...wordDetails,
          word: wordDetails.word.toLowerCase(),
          promptId: "",
        };

        examEntry.words.push(newWord);
        results.push({ term, result: { word: newWord.word } });
        continue;
      }

      results.push({
        term,
        result: { word: existingWord.word },
      });
    }

    await examEntry.save();
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

    For "memoryTrick", do not use the definition as the trick. Use a short
    mnemonic, sound-alike cue, visual association, or word-part connection that
    helps a learner remember the word.

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
  if (!exam) throw new Error("Exam is required.");

  const result = await ExamWords.findOne({
    exam: new RegExp(`^${escapeRegex(exam)}$`, "i"),
  });

  if (!result) throw new Error("Exam not found.");

  const startIndex = (page - 1) * limit;

  // Just return word + meaning
  const paginatedWords = result.words
    .slice(startIndex, startIndex + limit)
    .map((item: any) => ({
      word: item.word,
      meaning: item.meaning,
    }));

  return {
    exam: result.exam,
    totalWords: result.words.length,
    page,
    totalPages: Math.ceil(result.words.length / limit),
    words: paginatedWords, // simplified array
  };
};
