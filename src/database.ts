import mongoose from "mongoose";
import { logger } from "./utils/logger";

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      return;
    }
    if (mongoose.connection.readyState === 2) {
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI || "", {
      dbName: "dictionary",
    });
    logger.info("MongoDB connected");
  } catch (err) {
    logger.error("MongoDB connection error", err);
    throw err;
  }
};

export default connectDB;
