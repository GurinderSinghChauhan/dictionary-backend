import { z } from "zod";

const promptStyleSchema = z
  .enum(["meaning", "exampleSentence", "positivePrompt"])
  .optional();

const nonEmptyWordSchema = z.string().trim().min(1, "word cannot be empty");

export const addWordsSchema = z.object({
  words: z
    .array(nonEmptyWordSchema)
    .min(1, "words must contain at least one item"),
});

export const allWordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
});

export const deleteWordQuerySchema = z.object({
  word: nonEmptyWordSchema,
});

export const getImagesByWordsSchema = z.object({
  words: z
    .array(nonEmptyWordSchema)
    .min(1, "words must contain at least one item"),
});

export const categorizedWordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  subject: z.string().trim().optional(),
  grade: z.string().trim().optional(),
  exam: z.string().trim().optional(),
});

export const categorizedWordsParamsSchema = z.object({
  subject: z.string().trim().min(1).optional(),
  grade: z.string().trim().min(1).optional(),
  exam: z.string().trim().min(1).optional(),
});

export const subjectAddSchema = z.object({
  subject: z.string().trim().min(1, "subject is required"),
  words: z
    .array(nonEmptyWordSchema)
    .min(1, "words must contain at least one item"),
});

export const uploadWordsBodySchema = z.object({
  promptStyle: promptStyleSchema,
});

export const subjectUploadBodySchema = z.object({
  subject: z.string().trim().min(1, "subject is required"),
  promptStyle: promptStyleSchema,
});

export const subjectAssignBodySchema = z.object({
  subject: z.string().trim().min(1, "subject is required"),
});

export const gradeUploadBodySchema = z.object({
  grade: z.string().trim().min(1, "grade is required"),
  promptStyle: promptStyleSchema,
});

export const gradeAssignBodySchema = z.object({
  grade: z.string().trim().min(1, "grade is required"),
});

export const examUploadBodySchema = z.object({
  exam: z.string().trim().min(1, "exam is required"),
  promptStyle: promptStyleSchema,
});

export const examAssignBodySchema = z.object({
  exam: z.string().trim().min(1, "exam is required"),
});
