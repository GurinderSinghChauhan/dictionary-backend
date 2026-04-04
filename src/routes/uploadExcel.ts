// routes/uploadExcel.ts
import express from "express";
import multer from "multer";
import words from "../models/words";
import { requireAdmin } from "../middleware/auth";
import { defineManyWords, getImagesByWords } from "../services/admin/imageGen";
import { parseUniqueWordsFromUpload } from "../utils/wordList";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post(
  "/upload-excel",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    let uniqueWords: string[] = [];
    try {
      uniqueWords = parseUniqueWordsFromUpload(file);
    } catch {
      res.status(400).json({ error: "Unsupported file type" });
      return;
    }

    if (uniqueWords.length === 0) {
      res.status(400).json({ error: "No valid words found in file" });
      return;
    }

    const promptStyle =
      (req.body?.promptStyle as
        | "meaning"
        | "exampleSentence"
        | "positivePrompt") || "positivePrompt";
    const generationData = await defineManyWords(uniqueWords, promptStyle);

    res.json({ success: true, data: generationData });
  } catch (error: any) {
    console.error("File Upload Error:", error?.response?.data || error.message);
    res.status(500).json({ error: error?.response?.data || error.message || "Failed to process file" });
  }
});

router.post(
  "/assign-image",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    let uniqueWords: string[] = [];
    try {
      uniqueWords = parseUniqueWordsFromUpload(file);
    } catch {
      res.status(400).json({ error: "Unsupported file type" });
      return;
    }

    if (uniqueWords.length === 0) {
      res.status(400).json({ error: "No valid words found in file" });
      return;
    }

    const assignmentData = await getImagesByWords(uniqueWords);

    res.json({ success: true, data: assignmentData });
  } catch (error: any) {
    console.error("File Upload Error:", error?.response?.data || error.message);
    res.status(500).json({ error: error?.response?.data || error.message || "Failed to process file" });
  }
});


router.post(
  "/delete-by-file",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
       res.status(400).json({ error: "No file uploaded" });
       return
    }

    let uniqueWords: string[] = [];
    try {
      uniqueWords = parseUniqueWordsFromUpload(file);
    } catch {
      res.status(400).json({ error: "Unsupported file type" });
      return;
    }

    if (uniqueWords.length === 0) {
       res.status(400).json({ error: "No valid words found in file" });
       return
    }

    const deleteResult = await words.deleteMany({ word: { $in: uniqueWords } });

    res.json({
      message: `${deleteResult.deletedCount} words deleted successfully.`,
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error: any) {
    console.error("Delete File Error:", error);
    res.status(500).json({ error: error.message || "Failed to delete words" });
  }
});

export default router;
