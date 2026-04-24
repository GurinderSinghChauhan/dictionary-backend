import words from "../models/words";
import WordSense from "../models/wordSense";
import type { WordDetails } from "./wordServices";
import { normalizeWord } from "../utils/text";

type ContextType = "generic" | "subject" | "grade" | "exam";

const normalizeText = (value: unknown) => String(value || "").trim();

const buildSenseId = (
  word: string,
  partOfSpeech: string,
  contextType: ContextType,
  contextKey: string
) =>
  [
    normalizeWord(word),
    normalizeText(partOfSpeech).toLowerCase() || "unknown",
    contextType,
    normalizeText(contextKey).toLowerCase() || "default",
  ].join("-");

const buildSearchText = (
  word: string,
  details: Partial<WordDetails>,
  tags: string[]
) =>
  [
    word,
    details.partOfSpeech,
    details.meaning,
    details.exampleSentence,
    ...(details.synonyms || []),
    ...(details.antonyms || []),
    ...tags,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" ");

export async function ensureBaseWord(
  termRaw: string,
  details: WordDetails & { imageURL?: string; promptId?: string }
) {
  const term = normalizeWord(termRaw);
  const existing = await words.findOne({ word: term });

  if (existing) {
    const update: Record<string, unknown> = {};

    if (!existing.partOfSpeech && details.partOfSpeech) {
      update.partOfSpeech = details.partOfSpeech;
    }
    if (!existing.pronunciation && details.pronunciation) {
      update.pronunciation = details.pronunciation;
    }
    if ((!existing.wordForms || existing.wordForms.length === 0) && details.wordForms) {
      update.wordForms = details.wordForms;
    }
    if (!existing.origin && details.origin) {
      update.origin = details.origin;
    }
    if (!existing.imageURL && details.imageURL) {
      update.imageURL = details.imageURL;
    }
    if (!existing.promptId && details.promptId) {
      update.promptId = details.promptId;
    }

    if (Object.keys(update).length > 0) {
      await words.updateOne({ _id: existing._id }, { $set: update });
    }

    return existing._id;
  }

  const created = await words.create({
    word: term,
    partOfSpeech: details.partOfSpeech,
    pronunciation: details.pronunciation,
    wordForms: details.wordForms,
    meaning: details.meaning,
    exampleSentence: details.exampleSentence,
    synonyms: details.synonyms,
    antonyms: details.antonyms,
    memoryTrick: details.memoryTrick,
    origin: details.origin,
    positivePrompt: details.positivePrompt,
    negativePrompt: details.negativePrompt,
    imageURL: details.imageURL || "",
    promptId: details.promptId || "",
  });

  return created._id;
}

export async function upsertWordSense(
  termRaw: string,
  details: WordDetails & { imageURL?: string; promptId?: string },
  contextType: ContextType,
  contextKey: string
) {
  const term = normalizeWord(termRaw);
  const normalizedContextKey = normalizeText(contextKey).toLowerCase();
  const wordId = await ensureBaseWord(term, details);
  const senseId = buildSenseId(
    term,
    details.partOfSpeech,
    contextType,
    normalizedContextKey
  );
  const tags = normalizedContextKey ? [normalizedContextKey] : [];
  const shortDefinition =
    normalizeText(details.meaning).split(/[.;]/)[0]?.trim() ||
    normalizeText(details.meaning);

  const imageURL = normalizeText(details.imageURL);
  const updateSet: Record<string, unknown> = {
    senseId,
    wordId,
    word: term,
    normalizedWord: term,
    partOfSpeech: details.partOfSpeech,
    pronunciation: details.pronunciation,
    wordForms: details.wordForms,
    meaning: details.meaning,
    shortDefinition,
    exampleSentence: details.exampleSentence,
    synonyms: details.synonyms,
    antonyms: details.antonyms,
    memoryTrick: details.memoryTrick,
    origin: details.origin,
    contexts: [
      {
        type: contextType,
        key: normalizedContextKey,
        priority: contextType === "generic" ? 100 : 10,
      },
    ],
    "image.promptPositive": details.positivePrompt,
    "image.promptNegative": details.negativePrompt,
    tags,
    searchText: buildSearchText(term, details, tags),
    source: {
      type: "ai",
      model: "gpt-4.1-nano",
      importedFrom: "",
    },
    reviewStatus: "draft",
    status: "active",
    notes: "",
  };

  if (imageURL) {
    updateSet["image.url"] = imageURL;
    updateSet["image.provider"] = "cloudinary";
    updateSet["image.status"] = "ready";
  }

  await WordSense.updateOne(
    { senseId },
    {
      $set: updateSet,
      $setOnInsert: {
        "image.url": "",
        "image.provider": "",
        "image.status": "not_requested",
      },
    },
    { upsert: true }
  );

  return senseId;
}
