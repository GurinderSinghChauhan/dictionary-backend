// lib/models/gradeWords.ts
import mongoose from "mongoose";

const gradeWordsSchema = new mongoose.Schema({
  grade: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  words: {
    type: [
      {
        word: { type: String, required: true },
        partOfSpeech: String,
        pronunciation: String,
        wordForms: [String],
        meaning: String,
        exampleSentence: String,
        synonyms: [String],
        antonyms: [String],
        memoryTrick: String,
        origin: String,
        positivePrompt: String,
        negativePrompt: String,
        imageURL: String,
        promptId: String,
      },
    ],
    default: [],
  },
});

const GradeWords =
  mongoose.models.grade_words ||
  mongoose.model("grade_words", gradeWordsSchema);

export default GradeWords;
