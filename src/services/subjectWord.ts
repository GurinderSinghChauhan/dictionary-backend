// controllers/subject.ts
import SubjectWords from "../models/subjectWords";
import { WordDetails } from "./wordServices";
import {
  getImage,
  sendPromptAPI,
  uploadImageToS3,
} from "./generateImageWithComfyUI";
import { getOpenAIClient } from "./openaiClient";
import { waitForImageFilename } from "./imagePolling";
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

export const generateImageForSubject = async (
  subject: string,
  wordList: string[],
  promptStyle: "meaning" | "exampleSentence" | "positivePrompt"
) => {
  try {
    logger.info("Starting subject image generation", {
      subject,
      promptStyle,
      wordCount: wordList.length,
    });

    const cleanedWords = normalizeWordList(wordList);
    logger.info("Prepared subject word list", {
      subject,
      wordCount: cleanedWords.length,
    });

    // 🔎 Check if subject exists; if not, create it
    let subjectEntry = await SubjectWords.findOne({
      subject: new RegExp(`^${escapeRegex(subject)}$`, "i"),
    });

    if (!subjectEntry) {
      logger.warn("Subject entry not found, creating a new one", { subject });
      subjectEntry = await SubjectWords.create({ subject, words: [] });
    }

    const results = [];

    for (const term of cleanedWords) {
      logger.info("Processing subject term", { subject, term });

      const existingWord = subjectEntry.words.find(
        (w: any) => w.word.toLowerCase() === term
      );

      if (!existingWord) {
        logger.info("Generating new subject word details", { subject, term });

        const wordDetails = await getWordDetailsInContext(
          term,
          getSubjectContext(subject)
        );
        if (!wordDetails) {
          logger.warn("No subject word details found", { subject, term });
          results.push({ term, error: "Word details could not be fetched." });
          continue;
        }

        const promptId = await sendPromptAPI(
          promptStyle ? wordDetails[promptStyle] : (wordDetails.meaning ?? "")
        );
        logger.info("Generated prompt for new subject word", {
          subject,
          term,
          promptId,
        });

        const newWord = {
          ...wordDetails,
          word: wordDetails.word.toLowerCase(),
          promptId,
        };

        subjectEntry.words.push(newWord);
        results.push({
          term,
          result: { word: newWord.word },
          promptId,
        });

        continue;
      }

      if (existingWord.imageURL) {
        logger.info("Skipping subject term with existing image", {
          subject,
          term,
        });
        results.push({
          term,
          result: { word: existingWord.word },
          promptId: existingWord.promptId || null,
        });
        continue;
      }

      logger.info("Generating prompt for existing subject term", {
        subject,
        term,
      });
      const promptId = await sendPromptAPI(
        (existingWord[
          (promptStyle as keyof WordDetails) ?? "meaning"
        ] as string) || ""
      );
      logger.info("Generated prompt for existing subject word", {
        subject,
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

    // 💾 Save changes
    logger.info("Saving subject image generation results", { subject });
    await subjectEntry.save();

    logger.info("Completed subject image generation", { subject });
    return {
      success: true,
      subject,
      data: results,
    };
  } catch (error) {
    logger.error("Error generating image for subject", error);
    throw error;
  }
};

export const assignImageToSubjectWord = async (
  subject: string,
  wordList: string[]
) => {
  try {
    const results: any[] = [];

    const subjectDoc = await SubjectWords.findOne({
      subject: new RegExp(`^${escapeRegex(subject)}$`, "i"),
    });
    if (!subjectDoc) {
      throw new Error(`Subject "${subject}" not found`);
    }

    for (const word of wordList) {
      const wordObj = subjectDoc.words.find(
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

      if (!wordObj || !wordObj.promptId) {
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

      const imageAWSURL = await uploadImageToS3(imageURL, `${subject}-${word}`);

      const updated = await SubjectWords.findOneAndUpdate(
        {
          subject: new RegExp(`^${escapeRegex(subject)}$`, "i"),
          "words.word": new RegExp(`^${escapeRegex(word)}$`, "i"),
        },
        {
          $set: { "words.$.imageURL": imageAWSURL },
        },
        { new: true }
      );

      results.push({ word, status: "success", imageURL: imageAWSURL, updated });
    }

    return { subject, status: "done", results };
  } catch (error) {
    logger.error("Error assigning images to subject words", error);
    const wrappedError = new Error("Failed to assign images to subject words");
    (wrappedError as Error & { cause?: unknown }).cause = error;
    throw wrappedError;
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
    - The goal is to create an image prompt suitable for an AI model like Stable Diffusion or ComfyUI to generate an accurate, detailed picture of the word in action.
    - Avoid abstract explanations — think of how the word would look visually in real life or in a story-based educational scene.

    Example: For the word "pollination" in the context of biology, the positivePrompt could be:
    "A close-up shot of a honeybee landing on a vibrant yellow sunflower, collecting pollen, with fine pollen particles visible on its legs, under bright morning sunlight — realistic botanical detail, shallow depth of field."

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
    return data;
  } catch (err) {
    logger.error("Failed to parse subject word JSON response", err);
    // Return fallback with some defaults, or throw error as needed
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
