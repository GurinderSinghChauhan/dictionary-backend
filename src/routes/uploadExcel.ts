// routes/uploadExcel.ts
import express from "express";
import multer from "multer";
import words from "../models/words";
import { requireAdmin } from "../middleware/auth";
import { defineManyWords, getImagesByWords } from "../services/admin/imageGen";
import { logger } from "../utils/logger";
import { parseUniqueWordsFromUpload } from "../utils/wordList";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

const handleUploadExcel = async (
  req: express.Request,
  res: express.Response
) => {
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
    logger.error("File Upload Error", error?.response?.data || error.message);
    res.status(500).json({
      error: error?.response?.data || error.message || "Failed to process file",
    });
  }
};

const handleAssignImage = async (
  req: express.Request,
  res: express.Response
) => {
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
    logger.error("File Upload Error", error?.response?.data || error.message);
    res.status(500).json({
      error: error?.response?.data || error.message || "Failed to process file",
    });
  }
};

const handleDeleteByFile = async (
  req: express.Request,
  res: express.Response
) => {
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

    const deleteResult = await words.deleteMany({ word: { $in: uniqueWords } });

    res.json({
      message: `${deleteResult.deletedCount} words deleted successfully.`,
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error: any) {
    logger.error("Delete File Error", error);
    res.status(500).json({ error: error.message || "Failed to delete words" });
  }
};

/**
 * @swagger
 * /uploadExcel:
 *   post:
 *     tags:
 *       - Upload Excel
 *     summary: Upload and process Excel/CSV file with words (Admin only)
 *     description: Upload an Excel or CSV file containing words to generate definitions and images
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel (.xlsx) or CSV file containing words
 *               promptStyle:
 *                 type: string
 *                 enum: [meaning, exampleSentence, positivePrompt]
 *                 default: positivePrompt
 *                 description: Image generation prompt style
 *     responses:
 *       200:
 *         description: File processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *       400:
 *         description: No file uploaded or unsupported file type
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/upload-excel",
  requireAdmin,
  upload.single("file"),
  handleUploadExcel
);

router.post(
  "/uploadExcel",
  requireAdmin,
  upload.single("file"),
  handleUploadExcel
);

/**
 * @swagger
 * /uploadExcel/assign-image:
 *   post:
 *     tags:
 *       - Upload Excel
 *     summary: Assign images to words from file (Admin only)
 *     description: Upload a file with words to retrieve or assign existing images
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File containing words
 *     responses:
 *       200:
 *         description: Images assigned successfully
 *       400:
 *         description: No file uploaded or invalid file
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/assign-image",
  requireAdmin,
  upload.single("file"),
  handleAssignImage
);

/**
 * @swagger
 * /uploadExcel/delete-by-file:
 *   post:
 *     tags:
 *       - Upload Excel
 *     summary: Delete words from file (Admin only)
 *     description: Upload a file containing words to delete them from the database
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File containing words to delete
 *     responses:
 *       200:
 *         description: Words deleted successfully
 *       400:
 *         description: No file uploaded or invalid file
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/delete-by-file",
  requireAdmin,
  upload.single("file"),
  handleDeleteByFile
);

export default router;
