import OpenAI from "openai";
import ExamWords from "../models/examWords";
import {
  getImage,
  getPromptHistory,
  sendPromptAPI,
  uploadImageToS3,
} from "./generateImageWithComfyUI";
import { WordDetails } from "./wordServices";

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for generation features");
  }
  return new OpenAI({ apiKey });
};

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const generateImageForExam = async (
  exam: string,
  wordList: string[],
  promptStyle: "meaning" | "exampleSentence" | "positivePrompt"
) => {
  try {
    console.log("🔍 Starting image generation for exam:", exam);

    const cleanedWords = wordList
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);

    let examEntry = await ExamWords.findOne({
      exam: new RegExp(`^${escapeRegex(exam)}$`, "i"),
    });

    if (!examEntry) {
      examEntry = new ExamWords({ exam, words: [] });
    }

    const results = [];

    for (const term of cleanedWords) {
      let existingWord = examEntry.words.find(
        (w: any) => w.word.toLowerCase() === term
      );

      if (!existingWord) {
        const wordDetails = await getWordDetailsInContext(term, exam);
        if (!wordDetails) {
          results.push({ term, error: "Word details could not be fetched." });
          continue;
        }

        const promptId = await sendPromptAPI(
          promptStyle ? wordDetails[promptStyle] : wordDetails.positivePrompt
        );

        const newWord = {
          ...wordDetails,
          word: wordDetails.word.toLowerCase(),
          promptId,
        };

        examEntry.words.push(newWord);
        results.push({ term, result: { word: newWord.word }, promptId });
        continue;
      }

      if (existingWord.imageURL) {
        results.push({
          term,
          result: { word: existingWord.word },
          promptId: existingWord.promptId || null,
        });
        continue;
      }

      const promptId = await sendPromptAPI(
        promptStyle ? existingWord[promptStyle] : existingWord.positivePrompt
      );
      existingWord.promptId = promptId;
      results.push({ term, result: { word: existingWord.word }, promptId });
    }

    await examEntry.save();
    return { success: true, exam, data: results };
  } catch (err) {
    console.error("❌ Error generating image for exam:", err);
    throw err;
  }
};

export const assignImageToExamWord = async (
  exam: string,
  wordList: string[]
) => {
  try {
    const results: any[] = [];

    const examDoc = await ExamWords.findOne({
      exam: new RegExp(`^${escapeRegex(exam)}$`, "i"),
    });
    if (!examDoc) throw new Error(`Exam "${exam}" not found`);

    for (const word of wordList) {
      const wordObj = examDoc.words.find(
        (w: any) => w.word.toLowerCase() === word.toLowerCase()
      );

      if (!wordObj || wordObj.imageURL) {
        results.push({
          word,
          status: "skipped",
          reason: "Image already exists or word not found",
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

      const imageAWSURL = await uploadImageToS3(imageURL, `${exam}-${word}`);

      const updated = await ExamWords.findOneAndUpdate(
        {
          exam: new RegExp(`^${escapeRegex(exam)}$`, "i"),
          "words.word": new RegExp(`^${escapeRegex(word)}$`, "i"),
        },
        {
          $set: { "words.$.imageURL": imageAWSURL },
        },
        { new: true }
      );

      results.push({ word, status: "success", imageURL: imageAWSURL, updated });
    }

    return { exam, status: "done", results };
  } catch (err) {
    console.error("❌ Error in assignImageToExamWord:", err);
    throw new Error("Failed to assign images to exam words");
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
    return data;
  } catch (err) {
    console.error("❌ Failed to parse OpenAI response:", err);
    return null;
  }
}

async function waitForImageFilename(
  promptId: string,
  retries = 150,
  delay = 4000
): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    const history = await getPromptHistory(promptId);
    const outputNode = history?.[promptId]?.outputs?.["9"];
    if (outputNode?.images?.length > 0 && outputNode.images[0].filename) {
      return outputNode.images[0].filename;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return null;
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
