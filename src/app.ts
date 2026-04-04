import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import words from "./models/words";
import wordOfTheDay from "./models/wordOfTheDay";
import {
  getImage,
  getPromptHistory,
  uploadImageToS3,
} from "./services/generateImageWithComfyUI";
import authRoutes from "./routes/auth";
import allWordsRoutes from "./routes/allWords";
import uploadExcelRouter from "./routes/uploadExcel";
import subjectRouter from "./routes/subject";
import gradeRouter from "./routes/grade";
import examRouter from "./routes/exam";
import openApiSpec from "./docs/openapi.json";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

const app = express();
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  "https://grab-vocab.vercel.app",
  "http://localhost:5173",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:19006",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:8082",
  "http://127.0.0.1:19006",
  ...configuredOrigins,
]);

const isAllowedOrigin = (origin: string) => {
  if (allowedOrigins.has(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);
    const isLocalhost =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const isExpoPort = ["5173", "8081", "8082", "19006"].includes(url.port);

    return isLocalhost && isExpoPort;
  } catch {
    return false;
  }
};

const corsOptions: cors.CorsOptions = {
  origin: function (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions)); // ✅ Enable CORS
app.use(express.json());
app.set("trust proxy", 1);
app.use(limiter);

app.get("/openapi.json", (req, res) => {
  res.json(openApiSpec);
});

app.get("/docs", (req, res) => {
  res.type("html").send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dictionary Backend API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui"
      });
    </script>
  </body>
</html>`);
});

app.get("/", (req, res) => {
  res.send("Welcome to Dictionary!");
});

app.get("/hello", (req, res) => {
  res.send("Hello response!");
});

app.get("/define/:word", async (req, res) => {
  try {
    const term = req.params.word.toLowerCase();
    const existing = await words.findOne({ word: term });
    if (existing) {
      res.json({ term, result: existing, promptId: existing.promptId || null });
      return;
    }
    res.status(404).json({ error: `Word '${term}' not found in database.` });
  } catch (err) {
    console.error("❌ Error fetching word details:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/getImageURL/:promptId/:word", async (req, res) => {
  try {
    const { promptId, word } = req.params;

    const waitForImageFilename = async (
      currentPromptId: string,
      retries = 150,
      delay = 4000
    ) => {
      for (let i = 0; i < retries; i++) {
        const history = await getPromptHistory(currentPromptId);
        const outputNode = history?.[currentPromptId]?.outputs?.["9"];

        if (outputNode?.images?.length > 0 && outputNode.images[0].filename) {
          return outputNode.images[0].filename;
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return null;
    };

    const filename = await waitForImageFilename(promptId);
    if (!filename) {
      res.status(202).json({ message: "Image not ready", status: "pending" });
      return;
    }

    const imageURL = await getImage(filename);

    if (!imageURL) {
      res.status(500).json({ error: "Failed to retrieve image URL" });
      return;
    }
    const imageAWSURL = await uploadImageToS3(imageURL, filename);
    const updated = await words.findOneAndUpdate(
      { word: new RegExp(`^${escapeRegex(word)}$`, "i") },
      { $set: { imageURL: imageAWSURL } },
      { new: true }
    );

    res.json({ word, imageURL, status: "success", updated });
    return;
  } catch (err) {
    console.error("Error in getImageURL:", err);
    res.status(500).json({ error: "Failed to fetch image" });
  }
});

app.get("/wordoftheday", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const existing = await wordOfTheDay.findOne({ date: today });
    if (existing) {
      res.json({ word: existing.word, meaning: existing.meaning, date: today });
      return;
    }

    const [wordData] = await words.aggregate([{ $sample: { size: 1 } }]);
    if (!wordData?.word || !wordData?.meaning) {
      res.status(404).json({ error: "No words available in database" });
      return;
    }

    const saved = await wordOfTheDay.create({
      word: wordData.word,
      meaning: wordData.meaning,
      date: today,
    });

    res.json({ word: saved.word, meaning: saved.meaning, date: today });
    return;
  } catch (error) {
    console.error("Word of the Day error:", error);
    res.status(500).json({ error: "Could not fetch word of the day" });
  }
});

app.use("/subject", subjectRouter);
app.use("/grade", gradeRouter);
app.use("/api", uploadExcelRouter);
app.use("/auth", authRoutes);
app.use("/exam", examRouter);
app.use("/words", allWordsRoutes);

export default app;
