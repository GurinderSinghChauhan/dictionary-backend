import express, { Express } from "express";
import multer from "multer";
import fs from "fs";
import {
  assignImageToGradeWord,
  generateImageForGrade,
  getGradeWords,
} from "../services/gradeWord";
import GradeWords from "../models/gradeWords";
import { requireAdmin } from "../middleware/auth";
import { parseUniqueWordsFromDiskFile } from "../utils/wordList";
const upload = multer({ dest: "/tmp/uploads/" });
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
  async (req, res) => {
    const { grade } = req.body;
    const file = req.file;
    const promptStyle = req.body.promptStyle || "positivePrompt";

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
        console.log(`🆕 Grade "${grade}" created.`);
      }

      const wordList = parseUniqueWordsFromDiskFile(file.path);
      if (wordList.length === 0) {
        res.status(400).json({ error: "No valid words found in the file." });
        return;
      }

      // Process word list to generate images and metadata
      const data = await generateImageForGrade(
        grade,
        wordList,
        promptStyle as "meaning" | "exampleSentence" | "positivePrompt"
      );
      await assignImageToGradeWord(grade, wordList);

      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("❌ Error uploading grade words:", err);
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
    const { grade } = req.body;
    const file = req.file;

    try {
      if (!grade || !file) {
        res.status(400).json({ error: "Grade and file are required." });
        return;
      }

      const words = parseUniqueWordsFromDiskFile(file.path);
      if (words.length === 0) {
        res.status(400).json({ error: "No valid words found in the file." });
        return;
      }

      // Call uploadGradeWords with grade and list of words
      const data = await assignImageToGradeWord(grade, words);

      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("❌ Error uploading grade words:", err);
      res.status(500).json({ error: "Server error." });
    } finally {
      cleanupUploadedFile(file);
    }
  }
);

router.get("/", async (req, res) => {
  try {
    const fullUrl = new URL(
      req.protocol + "://" + req.get("host") + req.originalUrl
    );
    const grade = fullUrl.searchParams.get("grade") || "";
    const page = parseInt(fullUrl.searchParams.get("page") || "1");
    const limit = parseInt(fullUrl.searchParams.get("limit") || "10");

    if (!grade) {
      res.status(400).json({ success: false, error: "Grade is required." });
      return;
    }

    const data = await getGradeWords(grade, page, limit);

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

export default router;
