import dotenv from "dotenv";
import app from "./app";
import connectDB from "./database";
import { logger } from "./utils/logger";

dotenv.config();

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info("Server running", { port: PORT });
  });
});
