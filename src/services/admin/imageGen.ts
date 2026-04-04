import words from "../../models/words";
import {
  getImage,
  getPromptHistory,
  sendPromptAPI,
  uploadImageToS3,
} from "../generateImageWithComfyUI";
import { getWordDetails } from "../wordServices";

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const defineManyWords = async (
  wordArray: string[],
  promptStyle: "meaning" | "exampleSentence" | "positivePrompt"
) => {
  if (!Array.isArray(wordArray) || wordArray.length === 0) {
    throw new Error("Please provide a non-empty array of words.");
  }

  const results = [];

  for (const termRaw of wordArray) {
    const term = termRaw.toLowerCase();

    let existing = await words.findOne({ word: term });

    if (existing) {
      if (existing.imageURL) {
        results.push({
          term,
          result: existing,
          promptId: existing.promptId || null,
        });
        continue;
      }

      console.log(`🆕 Word "${term}" found, generating promptId...`);
      const promptId = await sendPromptAPI(
        promptStyle ? existing[promptStyle] : existing.positivePrompt
      );
      await words.updateOne({ word: term }, { $set: { promptId } });
      existing.promptId = promptId;
      results.push({ term, result: { word: existing.word }, promptId });
      continue;
    }

    const wordData = await getWordDetails(term);
    console.log(`🆕 Word "${term}" new, generating promptId...`);
    const promptId = await sendPromptAPI(
      promptStyle ? wordData[promptStyle] : wordData.positivePrompt
    );

    wordData.word = term;
    wordData.promptId = promptId;

    const savedWord = await words.create(wordData);
    results.push({ term, result: { word: savedWord.word }, promptId });
  }

  return { success: true, data: results };
};

const waitForImageFilename = async (
  promptId: string,
  retries = 150,
  delay = 4000
): Promise<string | null> => {
  for (let i = 0; i < retries; i++) {
    const history = await getPromptHistory(promptId);
    const outputNode = history?.[promptId]?.outputs?.["9"];

    if (outputNode?.images?.length > 0 && outputNode.images[0].filename) {
      return outputNode.images[0].filename;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return null;
};

export const getImagesByWords = async (wordList: string[]) => {
  if (!Array.isArray(wordList) || wordList.length === 0) {
    throw new Error("Input must be a non-empty array of words");
  }

  const results = [];

  for (const word of wordList) {
    try {
      const wordDoc = await words.findOne({
        word: new RegExp(`^${escapeRegex(word)}$`, "i"),
      });

      if (!wordDoc || !wordDoc.promptId) {
        results.push({
          word,
          status: "skipped",
          reason: "Not found or no promptId",
        });
        continue;
      }

      const filename = await waitForImageFilename(wordDoc.promptId);
      if (!filename) {
        results.push({
          word,
          status: "pending",
          reason: "Image not ready yet",
        });
        continue;
      }

      const imageURL = await getImage(filename);
      if (!imageURL) {
        results.push({
          word,
          status: "failed",
          reason: "Failed to fetch image",
        });
        continue;
      }

      const cleanFilename = `${word.toLowerCase().replace(/\s+/g, "_")}.png`;
      const s3URL = await uploadImageToS3(imageURL, cleanFilename);

      const updated = await words.findOneAndUpdate(
        { word: new RegExp(`^${escapeRegex(word)}$`, "i") },
        { $set: { imageURL: s3URL } },
        { new: true }
      );

      results.push({
        word,
        imageURL: s3URL,
        status: "success",
        updated,
      });
    } catch (err: any) {
      console.error(`❌ Error for word "${word}":`, err);
      results.push({ word, status: "error", message: err.message });
    }
  }

  return { success: true, results };
};
