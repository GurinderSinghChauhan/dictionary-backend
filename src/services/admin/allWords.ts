import mongoose from "mongoose";
import words from "../../models/words";
import WordSense from "../../models/wordSense";
import { escapeRegex, getPositiveInteger } from "../../utils/text";

type ContextItem = {
  type: string;
  key?: string;
  priority?: number;
};

type WordSenseResult = {
  word: string;
  normalizedWord: string;
  partOfSpeech?: string;
  pronunciation?: string;
  wordForms?: string[];
  meaning: string;
  shortDefinition?: string;
  exampleSentence?: string;
  synonyms?: string[];
  antonyms?: string[];
  memoryTrick?: string;
  origin?: string;
  senseId: string;
  contexts?: ContextItem[];
  image?: {
    url?: string;
  };
};

const getPrimaryContext = (contexts: ContextItem[] = []) =>
  contexts.find((context) => context.type === "generic") || contexts[0] || null;

const toFrontendSense = (sense: WordSenseResult) => {
  const context = getPrimaryContext(sense.contexts);

  return {
    word: sense.word,
    partOfSpeech: sense.partOfSpeech || "",
    pronunciation: sense.pronunciation || "",
    wordForms: sense.wordForms || [],
    meaning: sense.meaning,
    shortDefinition: sense.shortDefinition || "",
    exampleSentence: sense.exampleSentence || "",
    synonyms: sense.synonyms || [],
    antonyms: sense.antonyms || [],
    memoryTrick: sense.memoryTrick || "",
    origin: sense.origin || "",
    imageURL: sense.image?.url || "",
    senseId: sense.senseId,
    contextType: context?.type || "generic",
    contextKey: context?.key || "",
  };
};

const choosePrimarySense = (senses: WordSenseResult[]) =>
  senses.find((sense) =>
    sense.contexts?.some((context) => context.type === "generic")
  ) ||
  senses.find((sense) =>
    sense.contexts?.some((context) => context.type === "subject")
  ) ||
  senses.find((sense) =>
    sense.contexts?.some((context) => context.type === "grade")
  ) ||
  senses[0];

// Fetch all words with pagination and optional search
export async function getAllWords({
  page = 1,
  limit = 10,
  search = "",
}: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("Database connection unavailable");
  }

  const safePage = getPositiveInteger(page, 1);
  const safeLimit = getPositiveInteger(limit, 10);
  const skip = (safePage - 1) * safeLimit;
  const query = search
    ? {
        status: "active",
        $or: [
          { normalizedWord: { $regex: new RegExp(escapeRegex(search), "i") } },
          { word: { $regex: new RegExp(escapeRegex(search), "i") } },
        ],
      }
    : { status: "active" };

  const [groupedWords, totalResult] = await Promise.all([
    WordSense.aggregate([
      { $match: query },
      {
        $addFields: {
          sortPriority: {
            $switch: {
              branches: [
                {
                  case: {
                    $in: [
                      "generic",
                      {
                        $map: {
                          input: "$contexts",
                          as: "context",
                          in: "$$context.type",
                        },
                      },
                    ],
                  },
                  then: 0,
                },
                {
                  case: {
                    $in: [
                      "subject",
                      {
                        $map: {
                          input: "$contexts",
                          as: "context",
                          in: "$$context.type",
                        },
                      },
                    ],
                  },
                  then: 1,
                },
                {
                  case: {
                    $in: [
                      "grade",
                      {
                        $map: {
                          input: "$contexts",
                          as: "context",
                          in: "$$context.type",
                        },
                      },
                    ],
                  },
                  then: 2,
                },
              ],
              default: 3,
            },
          },
        },
      },
      { $sort: { normalizedWord: 1, sortPriority: 1, senseId: 1 } },
      {
        $group: {
          _id: "$normalizedWord",
          senses: {
            $push: {
              word: "$word",
              normalizedWord: "$normalizedWord",
              partOfSpeech: "$partOfSpeech",
              pronunciation: "$pronunciation",
              wordForms: "$wordForms",
              meaning: "$meaning",
              shortDefinition: "$shortDefinition",
              exampleSentence: "$exampleSentence",
              synonyms: "$synonyms",
              antonyms: "$antonyms",
              memoryTrick: "$memoryTrick",
              origin: "$origin",
              image: "$image",
              senseId: "$senseId",
              contexts: "$contexts",
            },
          },
        },
      },
      { $sort: { _id: 1 } },
      { $skip: skip },
      { $limit: safeLimit },
    ]),
    WordSense.aggregate([
      { $match: query },
      { $group: { _id: "$normalizedWord" } },
      { $count: "total" },
    ]),
  ]);
  const total = totalResult[0]?.total || 0;
  const wordDocs = groupedWords.map((group) => {
    const senses = group.senses.map(toFrontendSense);
    const primary = toFrontendSense(choosePrimarySense(group.senses));

    return {
      ...primary,
      senses,
      totalSenses: senses.length,
    };
  });

  return {
    words: wordDocs,
    total,
    page: safePage,
    totalPages: Math.ceil(total / safeLimit),
  };
}

// Delete a word by its text value
export async function deleteWord(word: string) {
  const deleted = await words.findOneAndDelete({ word });
  return !!deleted;
}
