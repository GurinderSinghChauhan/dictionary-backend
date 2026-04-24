// src/routes/exam.ts
import express, { Express } from "express";
import multer from "multer";
import fs from "fs";
import { getExamWords, uploadExamWords } from "../services/examWord";
import { requireAdmin } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { logger } from "../utils/logger";
import { parseUniqueWordsFromDiskFile } from "../utils/wordList";
import { getPositiveInteger } from "../utils/text";
import {
  categorizedWordsQuerySchema,
  examUploadBodySchema,
} from "../validation/words";

const upload = multer({ dest: "/tmp/uploads/" });
const router = express.Router();

const cleanupUploadedFile = (file?: Express.Multer.File) => {
  if (!file?.path) return;
  try {
    fs.unlinkSync(file.path);
  } catch {
    // best-effort cleanup
  }
};

router.get(
  "/",
  validateQuery(categorizedWordsQuerySchema),
  async (req, res) => {
    try {
      const exam = String(req.query.exam || "");
      const page = getPositiveInteger(req.query.page, 1);
      const limit = getPositiveInteger(req.query.limit, 10);

      if (!exam) {
        res.status(400).json({ success: false, error: "Exam is required." });
        return;
      }

      const data = await getExamWords(exam, page, limit);

      res.status(200).json({ success: true, ...data });
      return;
    } catch (err: any) {
      logger.error("Error fetching exam words", err);
      const status = err.message.includes("not found") ? 404 : 500;
      res.status(status).json({
        success: false,
        error: err.message || "Server error.",
      });
      return;
    }
  }
);

router.post(
  "/upload",
  requireAdmin,
  upload.single("file"),
  validateBody(examUploadBodySchema),
  async (req, res) => {
    const { exam } = req.body;
    const file = req.file;

    try {
      if (!exam || !file) {
        res.status(400).json({ error: "Exam and file are required." });
        return;
      }

      const wordList = parseUniqueWordsFromDiskFile(file.path);
      if (wordList.length === 0) {
        res.status(400).json({ error: "No valid words found in the file." });
        return;
      }

      const generationData = await uploadExamWords(exam, wordList);

      res.status(200).json({ success: true, data: generationData });
    } catch (err) {
      logger.error("Error uploading exam words", err);
      res.status(500).json({ error: "Server error." });
    } finally {
      cleanupUploadedFile(file);
    }
  }
);

export default router;
