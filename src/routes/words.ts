import express from "express";
import words from "../models/words";

const router = express.Router();

/**
 * @swagger
 * /words/{term}:
 *   get:
 *     tags:
 *       - Words
 *     summary: Get word details by term
 *     description: Retrieve complete information for a specific word including definition, example, and metadata
 *     parameters:
 *       - name: term
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The word to look up
 *     responses:
 *       200:
 *         description: Word found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 word:
 *                   type: string
 *                 meaning:
 *                   type: string
 *                 example:
 *                   type: string
 *                 imageURL:
 *                   type: string
 *       404:
 *         description: Word not found in database
 *       500:
 *         description: Server error
 */
router.get("/:term", async (req, res) => {
  try {
    const term = req.params.term.toLowerCase();

    const existing = await words.findOne({ word: term });
    if (!existing) {
      res.status(404).json({ error: `Word '${term}' not found in database.` });
      return;
    }

    res.json(existing);
  } catch (err) {
    console.error("Error saving word:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
