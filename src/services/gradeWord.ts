import { WordDetails } from "./wordServices";
import {
  getImage,
  sendPromptAPI,
  uploadImageToS3,
} from "./generateImageWithComfyUI";
import GradeWords from "../models/gradeWords";
import { getOpenAIClient } from "./openaiClient";
import { waitForImageFilename } from "./imagePolling";
import { logger } from "../utils/logger";
import { escapeRegex, normalizeWordList } from "../utils/text";

export const generateImageForGrade = async (
  grade: string,
  wordList: string[],
  promptStyle: "meaning" | "exampleSentence" | "positivePrompt"
) => {
  try {
    logger.info("Starting grade image generation", {
      grade,
      promptStyle,
      wordCount: wordList.length,
    });

    const cleanedWords = normalizeWordList(wordList);
    logger.info("Prepared grade word list", {
      grade,
      wordCount: cleanedWords.length,
    });

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
        logger.info("Generating new grade word details", { grade, term });
        const wordDetails = await getWordDetailsInContext(term, grade);
        if (!wordDetails) {
          logger.warn("No grade word details found", { grade, term });
          results.push({ term, error: "Word details could not be fetched." });
          continue;
        }

        const promptId = await sendPromptAPI(
          promptStyle
            ? wordDetails[promptStyle]
            : (wordDetails.positivePrompt ?? "")
        );
        logger.info("Generated prompt for new grade word", {
          grade,
          term,
          promptId,
        });

        const newWord = {
          ...wordDetails,
          word: wordDetails.word.toLowerCase(),
          promptId,
        };

        gradeEntry.words.push(newWord);
        results.push({
          term,
          result: { word: newWord.word, prompt: wordDetails.positivePrompt },
          promptId,
        });

        continue;
      }

      if (existingWord.imageURL) {
        logger.info("Skipping grade term with existing image", { grade, term });
        results.push({
          term,
          result: { word: existingWord.word },
          promptId: existingWord.promptId || null,
        });
        continue;
      }

      logger.info("Generating prompt for existing grade term", { grade, term });
      const promptId = await sendPromptAPI(
        promptStyle
          ? existingWord[promptStyle]
          : (existingWord.positivePrompt ?? "")
      );
      logger.info("Generated prompt for existing grade word", {
        grade,
        term,
        promptId,
      });

      existingWord.promptId = promptId;

      results.push({
        term,
        result: { word: existingWord.word },
        promptId,
      });
    }

    logger.info("Saving grade image generation results", { grade });
    await gradeEntry.save();

    logger.info("Completed grade image generation", { grade });
    return {
      success: true,
      grade,
      data: results,
    };
  } catch (error) {
    logger.error("Error generating image for grade", error);
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
  
    Format strictly as valid JSON with double quotes and all fields present.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0].message.content || "";

  try {
    const data: WordDetails = JSON.parse(text);
    return data;
  } catch (err) {
    logger.error("Failed to parse grade word JSON response", err);
    return {
      word,
      partOfSpeech: "",
      pronunciation: "",
      wordForms: [],
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

export const assignImageToGradeWord = async (
  grade: string,
  wordList: string[]
) => {
  try {
    const results: any[] = [];

    const gradeDoc = await GradeWords.findOne({
      grade: new RegExp(`^${escapeRegex(grade)}$`, "i"),
    });
    if (!gradeDoc) {
      throw new Error(`Grade "${grade}" not found`);
    }

    for (const word of wordList) {
      const wordObj = gradeDoc.words.find(
        (w: any) => w.word.toLowerCase() === word.toLowerCase()
      );

      if (!wordObj || wordObj.imageURL) {
        results.push({
          word,
          status: "skipped",
          reason: "Image already exists",
        });
        continue;
      }

      if (!wordObj.promptId) {
        results.push({ word, status: "skipped", reason: "promptId not found" });
        continue;
      }

      const filename = await waitForImageFilename(wordObj.promptId);
      if (!filename) {
        results.push({ word, status: "pending", reason: "Image not ready" });
        continue;
      }

      const imageURL = await getImage(filename);
      if (!imageURL) {
        results.push({
          word,
          status: "failed",
          reason: "Failed to retrieve image URL",
        });
        continue;
      }

      const imageAWSURL = await uploadImageToS3(imageURL, `${grade}-${word}`);

      const updated = await GradeWords.findOneAndUpdate(
        {
          grade: new RegExp(`^${escapeRegex(grade)}$`, "i"),
          "words.word": new RegExp(`^${escapeRegex(word)}$`, "i"),
        },
        {
          $set: { "words.$.imageURL": imageAWSURL },
        },
        { new: true }
      );

      results.push({ word, status: "success", imageURL: imageAWSURL, updated });
    }

    return { grade, status: "done", results };
  } catch (error) {
    logger.error("Error assigning images to grade words", error);
    const wrappedError = new Error("Failed to assign images to grade words");
    (wrappedError as Error & { cause?: unknown }).cause = error;
    throw wrappedError;
  }
};

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
