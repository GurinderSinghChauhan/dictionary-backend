import express from "express";
import words from "../models/words";

const router = express.Router();

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
    console.error("Error saving word:", err); // 🔴 Shows specific error
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
