import mongoose from "mongoose";

const WordSchema = new mongoose.Schema({
  word: { type: String, required: true, unique: true },
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
  promptId: String, // ID from the image generation service
});

export default mongoose.models.Word || mongoose.model("Word", WordSchema);
