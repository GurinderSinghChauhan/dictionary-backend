// src/routes/exam.ts
import express, { Express } from "express";
import multer from "multer";
import fs from "fs";
import {
  generateImageForExam,
  assignImageToExamWord,
  getExamWords,
} from "../services/examWord";
import ExamWords from "../models/examWords";
import { requireAdmin } from "../middleware/auth";
import { parseUniqueWordsFromDiskFile } from "../utils/wordList";
import { escapeRegex, getPositiveInteger } from "../utils/text";

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

router.get("/", async (req, res) => {
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
    console.error("❌ API error:", err.message);
    const status = err.message.includes("not found") ? 404 : 500;
    res.status(status).json({
      success: false,
      error: err.message || "Server error.",
    });
    return;
  }
});

router.post(
  "/upload",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    const { exam } = req.body;
    const file = req.file;
    const promptStyle = req.body.promptStyle || "positivePrompt";

    try {
      if (!exam || !file) {
        res.status(400).json({ error: "Exam and file are required." });
        return;
      }

      let examEntry = await ExamWords.findOne({
        exam: new RegExp(`^${escapeRegex(exam)}$`, "i"),
      });

      if (!examEntry) {
        examEntry = await ExamWords.create({ exam, words: [] });
        console.log(`🆕 Exam "${exam}" created.`);
      }

      const wordList = parseUniqueWordsFromDiskFile(file.path);
      if (wordList.length === 0) {
        res.status(400).json({ error: "No valid words found in the file." });
        return;
      }

      const generationData = await generateImageForExam(
        exam,
        wordList,
        promptStyle as "meaning" | "exampleSentence" | "positivePrompt"
      );
      await assignImageToExamWord(exam, wordList);

      res.status(200).json({ success: true, data: generationData });
    } catch (err) {
      console.error("❌ Error uploading exam words:", err);
      res.status(500).json({ error: "Server error." });
    } finally {
      cleanupUploadedFile(file);
    }
  }
);

router.post(
  "/assign",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    const { exam } = req.body;
    const file = req.file;

    try {
      if (!exam || !file) {
        res.status(400).json({ error: "Exam and file are required." });
        return;
      }

      const words = parseUniqueWordsFromDiskFile(file.path);
      if (words.length === 0) {
        res.status(400).json({ error: "No valid words found in the file." });
        return;
      }

      const data = await assignImageToExamWord(exam, words);

      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("❌ Error assigning images for exam words:", err);
      res.status(500).json({ error: "Server error." });
    } finally {
      cleanupUploadedFile(file);
    }
  }
);

export default router;
