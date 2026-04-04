import mongoose from "mongoose";

const wordOfDaySchema = new mongoose.Schema({
  word: { type: String, required: true },
  meaning: { type: String, required: true },
  date: { type: String, required: true, unique: true }, // YYYY-MM-DD
});

export default mongoose.model("WordOfDay", wordOfDaySchema);
