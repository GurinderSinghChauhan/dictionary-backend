import express, { Express } from "express";
import {
  addSubjectWords,
  assignImageToSubjectWord,
  generateImageForSubject,
  getSubjectWords,
} from "../services/subjectWord";
import multer from "multer";
import fs from "fs";
import { requireAdmin } from "../middleware/auth";
import { parseUniqueWordsFromDiskFile } from "../utils/wordList";
import { getPositiveInteger } from "../utils/text";

const router = express.Router();
const upload = multer({ dest: "/tmp/uploads/" });

const cleanupUploadedFile = (file?: Express.Multer.File) => {
  if (!file?.path) return;
  try {
    fs.unlinkSync(file.path);
  } catch {
    // best-effort cleanup
  }
};

// Add or update words for a subject
router.post("/add", requireAdmin, async (req, res) => {
  try {
    const { subject, words } = req.body;

    if (!subject || !Array.isArray(words) || words.length === 0) {
      res.status(400).json({ error: "Subject and words array are required." });
      return;
    }

    const updated = await addSubjectWords(subject, words);
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("❌ Error adding subject words:", err);
    const message = err instanceof Error ? err.message : "Server error.";
    const status = message.includes("required") ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

// Get words for a subject
// routes/subject.ts
router.get("/:subject", async (req, res) => {
  console.log("🎯 Subject route hit:", req.params.subject);
  try {
    const subject = req.params.subject;
    const page = getPositiveInteger(req.query.page, 1);
    const limit = getPositiveInteger(req.query.limit, 10);

    const data = await getSubjectWords(subject, page, limit);

    if (!data) {
      res.status(404).json({ error: "Subject not found." });
      return;
    }

    res.status(200).json({ success: true, ...data });
  } catch (err: any) {
    console.error("❌ Error getting subject words:", err.message);
    res.status(500).json({ error: err.message || "Server error." });
  }
});

router.post(
  "/upload",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    const { subject } = req.body;
    const file = req.file;
    const promptStyle = req.body.promptStyle;

    try {
      if (!subject || !file) {
        res.status(400).json({ error: "Subject and file are required." });
        return;
      }

      const wordList = parseUniqueWordsFromDiskFile(file.path);
      if (wordList.length === 0) {
        res.status(400).json({ error: "No valid words found in the file." });
        return;
      }

      // Call uploadSubjectWords with subject and list of words
      const data = await generateImageForSubject(subject, wordList, promptStyle);
      await assignImageToSubjectWord(subject, wordList);

      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("❌ Error uploading subject words:", err);
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
    const { subject } = req.body;
    const file = req.file;

    try {
      if (!subject || !file) {
        res.status(400).json({ error: "Subject and file are required." });
        return;
      }

      const words = parseUniqueWordsFromDiskFile(file.path);
      if (words.length === 0) {
        res.status(400).json({ error: "No valid words found in the file." });
        return;
      }

      // Call uploadSubjectWords with subject and list of words
      const data = await assignImageToSubjectWord(subject, words);

      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("❌ Error uploading subject words:", err);
      res.status(500).json({ error: "Server error." });
    } finally {
      cleanupUploadedFile(file);
    }
  }
);

router.get("/", async (req, res) => {
  try {
    const subject = String(req.query.subject || "");
    const page = getPositiveInteger(req.query.page, 1);
    const limit = getPositiveInteger(req.query.limit, 10);

    if (!subject) {
      res.status(400).json({ success: false, error: "Subject is required." });
      return;
    }

    const data = await getSubjectWords(subject, page, limit);

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
