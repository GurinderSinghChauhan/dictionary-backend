import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

async function connectDictionaryDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  await mongoose.connect(uri, { dbName: "dictionary" });
  return mongoose.connection.db;
}

async function main() {
  const db = await connectDictionaryDb();
  const count = await db.collection("words").countDocuments({});

  console.log(
    JSON.stringify(
      {
        database: "dictionary",
        collection: "words",
        count,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
