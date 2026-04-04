import { z } from "zod";

export const addWordsSchema = z.object({
  words: z
    .array(z.string().trim().min(1, "word cannot be empty"))
    .min(1, "words must contain at least one item"),
});

export const allWordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
});
