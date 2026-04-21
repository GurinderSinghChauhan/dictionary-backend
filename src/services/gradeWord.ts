import { ensureWordForms, inferWordForms, WordDetails } from "./wordServices";
import GradeWords from "../models/gradeWords";
import { getOpenAIClient } from "./openaiClient";
import { logger } from "../utils/logger";
import { escapeRegex, normalizeWordList } from "../utils/text";

export const uploadGradeWords = async (grade: string, wordList: string[]) => {
  try {
    const cleanedWords = normalizeWordList(wordList);

    let gradeEntry = await GradeWords.findOne({
      grade: new RegExp(`^${escapeRegex(grade)}$`, "i"),
    });

    if (!gradeEntry) {
      logger.warn("Grade entry not found, creating a new one", { grade });
      gradeEntry = new GradeWords({ grade: grade, words: [] });
    }

    const results = [];

    for (const term of cleanedWords) {
      logger.info("Processing grade term", { grade, term });

      const existingWord = gradeEntry.words.find(
        (w: any) => w.word.toLowerCase() === term
      );

      if (!existingWord) {
        const wordDetails = await getWordDetailsInContext(term, grade);
        if (!wordDetails) {
          results.push({ term, error: "Word details could not be fetched." });
          continue;
        }

        const newWord = {
          ...wordDetails,
          word: wordDetails.word.toLowerCase(),
          promptId: "",
        };

        gradeEntry.words.push(newWord);
        results.push({
          term,
          result: { word: newWord.word, prompt: wordDetails.positivePrompt },
        });

        continue;
      }

      results.push({
        term,
        result: { word: existingWord.word },
      });
    }

    await gradeEntry.save();

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
  if (!grade) throw new Error("Grade is required.");

  const result = await GradeWords.findOne({
    grade: new RegExp(`^${escapeRegex(grade)}$`, "i"),
  });

  if (!result) throw new Error("Grade not found.");

  const startIndex = (page - 1) * limit;

  // Just return word + meaning
  const paginatedWords = result.words
    .slice(startIndex, startIndex + limit)
    .map((item: any) => ({
      word: item.word,
      meaning: item.meaning,
    }));

  return {
    grade: result.grade,
    totalWords: result.words.length,
    page,
    totalPages: Math.ceil(result.words.length / limit),
    words: paginatedWords, // simplified array
  };
};
