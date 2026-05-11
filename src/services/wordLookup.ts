import words from "../models/words";
import WordSense from "../models/wordSense";
import { normalizeWord } from "../utils/text";

type ContextType = "generic" | "subject" | "grade" | "exam";
type ContextItem = {
  type: ContextType;
  key?: string;
  priority?: number;
};
type SenseLike = {
  meaning: string;
  image?: {
    url?: string;
  };
  contexts?: ContextItem[];
};

export interface LookupContext {
  contextType?: ContextType;
  contextKey?: string;
}

const normalizeContextKey = (value?: string) =>
  String(value || "").trim().toLowerCase();

const toFrontendSense = (sense: SenseLike) => ({
  ...sense,
  imageURL: sense.image?.url || "",
});

export async function lookupWord(termRaw: string, context: LookupContext = {}) {
  const term = normalizeWord(termRaw);
  const contextType = context.contextType;
  const contextKey = normalizeContextKey(context.contextKey);

  const allSenses = await WordSense.find({
    normalizedWord: term,
    status: "active",
  }).lean();

  if (allSenses.length > 0) {
    const matchedSenses = contextType
      ? allSenses.filter((sense) =>
          sense.contexts?.some((item: ContextItem) => {
            if (item.type !== contextType) {
              return false;
            }

            if (contextType === "generic") {
              return true;
            }

            return normalizeContextKey(item.key) === contextKey;
          })
        )
      : allSenses;

    if (matchedSenses.length === 0 && contextType) {
      return null;
    }

    const orderedSenses = ([...matchedSenses] as unknown as SenseLike[]).sort(
      (left, right) => {
      const leftPriority = Math.min(
        ...(left.contexts || [])
          .filter((item) =>
            contextType ? item.type === contextType : true
          )
          .map((item) => item.priority ?? 100),
        100
      );
      const rightPriority = Math.min(
        ...(right.contexts || [])
          .filter((item) =>
            contextType ? item.type === contextType : true
          )
          .map((item) => item.priority ?? 100),
        100
      );

        return (
          leftPriority - rightPriority ||
          left.meaning.localeCompare(right.meaning)
        );
      }
    );

    const frontendSenses = orderedSenses.map(toFrontendSense);
    const primarySense = frontendSenses[0];

    return {
      source: "word_senses" as const,
      term,
      requestedContext: contextType
        ? {
            type: contextType,
            key: contextType === "generic" ? "" : contextKey,
          }
        : null,
      result: primarySense,
      senses: frontendSenses,
      totalSenses: orderedSenses.length,
    };
  }

  const existing = await words.findOne({ word: term }).lean();
  if (!existing) {
    return null;
  }

  return {
    source: "words" as const,
    term,
    requestedContext: contextType
      ? {
          type: contextType,
          key: contextType === "generic" ? "" : contextKey,
        }
      : null,
    result: existing,
    senses: [existing],
    totalSenses: 1,
    promptId: (existing as { promptId?: string }).promptId || null,
  };
}
