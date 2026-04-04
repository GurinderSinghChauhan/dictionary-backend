// routes/allWords.ts
import express, { Express } from "express";
import { getAllWords, deleteWord } from "../services/admin/allWords";
import { defineManyWords, getImagesByWords } from "../services/admin/imageGen";
import fs from "fs";
import multer from "multer";
import { requireAdmin } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { logger } from "../utils/logger";
import { parseUniqueWordsFromDiskFile } from "../utils/wordList";
import { addWordsSchema, allWordsQuerySchema } from "../validation/words";

const router = express.Router();

/**
 * @swagger
 * /words:
 *   get:
 *     tags:
 *       - Words - All Words
 *     summary: Get all words with pagination
 *     description: Retrieve paginated list of all words with optional search filtering
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of words per page
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Search term to filter words
 *     responses:
 *       200:
 *         description: Words list with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 words:
 *                   type: array
 *                   items:
 *                     type: object
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *       500:
 *         description: Server error
 */
router.get("/", validateQuery(allWordsQuerySchema), async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const search = String(req.query.search || "");

    const result = await getAllWords({ page, limit, search });
    res.json(result);
  } catch (err) {
    logger.error("Error in /allWords", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /words:
 *   delete:
 *     tags:
 *       - Words - All Words
 *     summary: Delete a word (Admin only)
 *     description: Delete a specific word from the database
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: word
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: The word to delete
 *     responses:
 *       200:
 *         description: Word deleted successfully
 *       400:
 *         description: Missing word parameter
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
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
    logger.error("Error deleting word", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const upload = multer({ dest: "/tmp/uploads/" });

const cleanupUploadedFile = (file?: Express.Multer.File) => {
  if (!file?.path) return;
  try {
    fs.unlinkSync(file.path);
  } catch {
    // swallow cleanup errors
  }
};

/**
 * @swagger
 * /words/upload:
 *   post:
 *     tags:
 *       - Words - All Words
 *     summary: Upload words from file (Admin only)
 *     description: Upload and process words from Excel or text file
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File containing words (.xlsx, .csv, .txt)
 *               promptStyle:
 *                 type: string
 *                 enum: [meaning, exampleSentence, positivePrompt]
 *                 default: positivePrompt
 *                 description: Image generation prompt style
 *     responses:
 *       200:
 *         description: Words uploaded and processed successfully
 *       400:
 *         description: Missing file or no valid words found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/upload",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    const file = req.file;
    const promptStyle = req.body.promptStyle || "positivePrompt";
    try {
      if (!file) {
        res.status(400).json({ error: "File is required." });
        return;
      }

      const filePath = file.path;
      const wordList = parseUniqueWordsFromDiskFile(filePath);

      if (wordList.length === 0) {
        res.status(400).json({ error: "No valid words found in the file." });
        return;
      }

      const generationData = await defineManyWords(wordList, promptStyle);
      const imageAssignment = await getImagesByWords(wordList);

      res.status(200).json({
        success: true,
        generation: generationData,
        imageAssignment,
      });
    } catch (err) {
      logger.error("Error uploading words", err);
      res.status(500).json({ error: "Server error." });
    } finally {
      cleanupUploadedFile(file);
    }
  }
);

router.post(
  "/add",
  requireAdmin,
  validateBody(addWordsSchema),
  async (req, res) => {
    try {
      const wordList = req.body.words.map((word: string) =>
        word.trim().toLowerCase()
      );

      const generationData = await defineManyWords(wordList, "positivePrompt");
      res.status(200).json({ success: true, data: generationData });
    } catch (err) {
      logger.error("Error adding words", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * @swagger
 * /words/getImagesByWords:
 *   post:
 *     tags:
 *       - Words - All Words
 *     summary: Get images for words (Admin only)
 *     description: Retrieve or generate images for a list of words
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - words
 *             properties:
 *               words:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of words to get images for
 *     responses:
 *       200:
 *         description: Images retrieved successfully
 *       400:
 *         description: Missing or empty words array
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/getImagesByWords", requireAdmin, async (req, res) => {
  try {
    const words = Array.isArray(req.body?.words) ? req.body.words : [];
    if (!words.length) {
      res
        .status(400)
        .json({ error: "Body must include non-empty words array" });
      return;
    }

    const result = await getImagesByWords(words);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    logger.error("Error in /getImagesByWords", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
