import mongoose from "mongoose";

const contextTypeValues = ["generic", "subject", "grade", "exam"] as const;
const imageStatusValues = [
  "not_requested",
  "pending",
  "ready",
  "failed",
] as const;
const sourceTypeValues = ["ai", "manual", "import", "migration"] as const;
const reviewStatusValues = ["draft", "reviewed", "approved"] as const;

const contextSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: contextTypeValues,
      required: true,
    },
    key: {
      type: String,
      default: "",
      trim: true,
    },
    priority: {
      type: Number,
      default: 100,
      min: 0,
    },
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    promptPositive: {
      type: String,
      default: "",
      trim: true,
    },
    promptNegative: {
      type: String,
      default: "",
      trim: true,
    },
    url: {
      type: String,
      default: "",
      trim: true,
    },
    provider: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: imageStatusValues,
      default: "not_requested",
    },
  },
  { _id: false }
);

const sourceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: sourceTypeValues,
      default: "ai",
    },
    model: {
      type: String,
      default: "",
      trim: true,
    },
    importedFrom: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const WordSenseSchema = new mongoose.Schema(
  {
    senseId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    wordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Word",
      index: true,
    },
    word: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedWord: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    partOfSpeech: {
      type: String,
      default: "",
      trim: true,
    },
    pronunciation: {
      type: String,
      default: "",
      trim: true,
    },
    wordForms: {
      type: [String],
      default: [],
    },
    meaning: {
      type: String,
      required: true,
      trim: true,
    },
    shortDefinition: {
      type: String,
      default: "",
      trim: true,
    },
    exampleSentence: {
      type: String,
      default: "",
      trim: true,
    },
    synonyms: {
      type: [String],
      default: [],
    },
    antonyms: {
      type: [String],
      default: [],
    },
    memoryTrick: {
      type: String,
      default: "",
      trim: true,
    },
    origin: {
      type: String,
      default: "",
      trim: true,
    },
    contexts: {
      type: [contextSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => Array.isArray(value) && value.length > 0,
        message: "At least one context is required",
      },
    },
    image: {
      type: imageSchema,
      default: () => ({}),
    },
    tags: {
      type: [String],
      default: [],
    },
    searchText: {
      type: String,
      default: "",
      trim: true,
    },
    source: {
      type: sourceSchema,
      default: () => ({}),
    },
    reviewStatus: {
      type: String,
      enum: reviewStatusValues,
      default: "draft",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    collection: "word_senses",
    timestamps: true,
  }
);

WordSenseSchema.index(
  { normalizedWord: 1, "contexts.type": 1, "contexts.key": 1 },
  { name: "sense_context_lookup" }
);
WordSenseSchema.index(
  { wordId: 1, normalizedWord: 1 },
  { name: "sense_word_lookup" }
);

export default mongoose.models.WordSense ||
  mongoose.model("WordSense", WordSenseSchema);
