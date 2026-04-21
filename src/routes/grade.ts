import express, { Express } from "express";
import multer from "multer";
import fs from "fs";
import { getGradeWords, uploadGradeWords } from "../services/gradeWord";
import GradeWords from "../models/gradeWords";
import { requireAdmin } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { logger } from "../utils/logger";
import { parseUniqueWordsFromDiskFile } from "../utils/wordList";
import { escapeRegex, getPositiveInteger } from "../utils/text";
import {
  categorizedWordsQuerySchema,
  gradeUploadBodySchema,
} from "../validation/words";
const upload = multer({ dest: "/tmp/uploads/" });

const cleanupUploadedFile = (file?: Express.Multer.File) => {
  if (!file?.path) return;
  try {
    fs.unlinkSync(file.path);
  } catch {
    // best-effort cleanup
  }
};

const router = express.Router();

router.post(
  "/upload",
  requireAdmin,
  upload.single("file"),
  validateBody(gradeUploadBodySchema),
  async (req, res) => {
    const { grade } = req.body;
    const file = req.file;

    try {
      if (!grade || !file) {
        res.status(400).json({ error: "Grade and file are required." });
        return;
      }

      // Ensure the grade document exists (case-insensitive check)
      let gradeEntry = await GradeWords.findOne({
        grade: new RegExp(`^${escapeRegex(grade)}$`, "i"),
      });

      if (!gradeEntry) {
        gradeEntry = await GradeWords.create({ grade, words: [] });
        logger.info("Created grade entry", { grade });
      }

      const wordList = parseUniqueWordsFromDiskFile(file.path);
      if (wordList.length === 0) {
        res.status(400).json({ error: "No valid words found in the file." });
        return;
      }

      const data = await uploadGradeWords(grade, wordList);

      res.status(200).json({ success: true, data });
    } catch (err) {
      logger.error("Error uploading grade words", err);
      res.status(500).json({ error: "Server error." });
    } finally {
      cleanupUploadedFile(file);
    }
  }
);

router.get(
  "/",
  validateQuery(categorizedWordsQuerySchema),
  async (req, res) => {
    try {
      const grade = String(req.query.grade || "");
      const page = getPositiveInteger(req.query.page, 1);
      const limit = getPositiveInteger(req.query.limit, 10);

      if (!grade) {
        res.status(400).json({ success: false, error: "Grade is required." });
        return;
      }

      const data = await getGradeWords(grade, page, limit);

      res.status(200).json({ success: true, ...data });
      return;
    } catch (err: any) {
      logger.error("Error fetching grade words", err);
      const status = err.message.includes("not found") ? 404 : 500;
      res.status(status).json({
        success: false,
        error: err.message || "Server error.",
      });
      return;
    }
  }
);

export default router;
