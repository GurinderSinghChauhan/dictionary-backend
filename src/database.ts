import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

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
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }
};

export default connectDB;
