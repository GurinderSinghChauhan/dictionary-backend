// routes/allWords.ts
import express, { Express } from "express";
import { getAllWords, deleteWord } from "../services/admin/allWords";
import { defineManyWords, getImagesByWords } from "../services/admin/imageGen";
import fs from "fs";
import multer from "multer";
import { requireAdmin } from "../middleware/auth";
import { parseUniqueWordsFromDiskFile } from "../utils/wordList";

const router = express.Router();

// GET /allWords?page=1&limit=10&search=word
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    const result = await getAllWords({ page, limit, search });
    res.json(result);
  } catch (err) {
    console.error("❌ Error in /allWords:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /allWords?word=example
router.delete("/", requireAdmin, async (req, res) => {
  try {
    const word = req.query.word as string;
    if (!word) {
      res.status(400).json({ error: "Missing 'word' param" });
      return;
    }

    const success = await deleteWord(word);
    res.json({ success });
  } catch (err) {
    console.error("❌ Error deleting word:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// router.post("/define-many", async (req, res) => {
//   try {
//     await defineManyWords(req, res);
//     await getImagesByWords(req, res);

//   } catch (err) {
//     console.error("❌ Error in /define-many:", err);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });
const upload = multer({ dest: "/tmp/uploads/" });

const cleanupUploadedFile = (file?: Express.Multer.File) => {
  if (!file?.path) return;
  try {
    fs.unlinkSync(file.path);
  } catch {
    // swallow cleanup errors
  }
};

router.post(
  "/upload",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    const file = req.file;
    const promptStyle = req.body.promptStyle || "positivePrompt";
    console.log("📁 Received file:", file?.originalname || "None");

    try {
      if (!file) {
        console.warn("❌ Missing file in request.");
        res.status(400).json({ error: "File is required." });
        return;
      }

      const filePath = file.path;
      console.log("📄 Reading file from:", filePath);
      const wordList = parseUniqueWordsFromDiskFile(filePath);

      if (wordList.length === 0) {
        console.warn("⚠️ File contained no valid words. Deleted.");
        res.status(400).json({ error: "No valid words found in the file." });
        return;
      }

      console.log("✅ Parsed unique words:", wordList.length);
      console.log("🔤 Sample words:", wordList.slice(0, 10));

      const generationData = await defineManyWords(wordList, promptStyle);
      const imageAssignment = await getImagesByWords(wordList);

      res.status(200).json({
        success: true,
        generation: generationData,
        imageAssignment,
      });
    } catch (err) {
      console.error("❌ Error uploading exam words:", err);
      res.status(500).json({ error: "Server error." });
    } finally {
      cleanupUploadedFile(file);
    }
  }
);

router.post("/getImagesByWords", requireAdmin, async (req, res) => {
  try {
    const words = Array.isArray(req.body?.words) ? req.body.words : [];
    if (!words.length) {
      res.status(400).json({ error: "Body must include non-empty words array" });
      return;
    }

    const result = await getImagesByWords(words);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("❌ Error in /getImagesByWords:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
