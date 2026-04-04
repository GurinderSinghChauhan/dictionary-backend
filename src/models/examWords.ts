// models/examWords.ts
import mongoose from "mongoose";

const examWordsSchema = new mongoose.Schema({
  exam: {
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

const ExamWords =
  mongoose.models.exam_words || mongoose.model("exam_words", examWordsSchema);

export default ExamWords;
