import { WordDetails } from "./wordServices";
import {
  getImage,
  sendPromptAPI,
  uploadImageToS3,
} from "./generateImageWithComfyUI";
import GradeWords from "../models/gradeWords";
import { getOpenAIClient } from "./openaiClient";
import { waitForImageFilename } from "./imagePolling";
import { escapeRegex, normalizeWordList } from "../utils/text";

export const generateImageForGrade = async (
  grade: string,
  wordList: string[],
  promptStyle: "meaning" | "exampleSentence" | "positivePrompt"
) => {
  try {
    console.log("🔍 Starting image generation for grade:", grade, promptStyle);
    console.log("📜 Received word list:", wordList);

    const cleanedWords = normalizeWordList(wordList);

    console.log("🧹 Cleaned word list:", cleanedWords);

    let gradeEntry = await GradeWords.findOne({
      grade: new RegExp(`^${escapeRegex(grade)}$`, "i"),
    });

    if (!gradeEntry) {
      console.warn(`⚠️ Grade "${grade}" not found. Creating new entry.`);
      gradeEntry = new GradeWords({ grade: grade, words: [] });
    }

    const results = [];

    for (const term of cleanedWords) {
      console.log("🔎 Processing term:", term);

      let existingWord = gradeEntry.words.find(
        (w: any) => w.word.toLowerCase() === term
      );

      if (!existingWord) {
        console.log(`🆕 Word "${term}" not found. Generating details...`);
        const wordDetails = await getWordDetailsInContext(term, grade);
        if (!wordDetails) {
          console.warn(`⚠️ No details found for "${term}"`);
          results.push({ term, error: "Word details could not be fetched." });
          continue;
        }

        const promptId = await sendPromptAPI(
          promptStyle
            ? wordDetails[promptStyle]
            : wordDetails.positivePrompt ?? ""
        );
        console.log(
          `df Prompt ID received for new word "${term}":`,
          wordDetails.meaning
        );

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
        console.log(`🖼️ Skipping "${term}" — image already exists.`);
        results.push({
          term,
          result: { word: existingWord.word },
          promptId: existingWord.promptId || null,
        });
        continue;
      }

      console.log(`📤 Sending prompt for "${term}"...`);
      const promptId = await sendPromptAPI(
        promptStyle
          ? existingWord[promptStyle]
          : existingWord.positivePrompt ?? ""
      );
      console.log(`✅ Prompt ID received for "${term}":`, existingWord.meaning);

      existingWord.promptId = promptId;

      results.push({
        term,
        result: { word: existingWord.word },
        promptId,
      });
    }

    console.log("💾 Saving updates to grade document...");
    await gradeEntry.save();

    console.log("✅ Image generation for grade completed.");
    return {
      success: true,
      grade,
      data: results,
    };
  } catch (error) {
    console.error("❌ Error generating image for grade:", error);
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
    console.error("Failed to parse JSON response:", err);
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
    console.error("❌ Error in assignImageToGradeWord:", error);
    throw new Error("Failed to assign images to grade words");
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
