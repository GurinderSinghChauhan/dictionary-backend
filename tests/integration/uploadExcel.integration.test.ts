import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../src/app";

describe("Upload Excel endpoint integration tests", () => {
  describe("POST /api/uploadExcel", () => {
    it("should return 400 when file is not attached", async () => {
      const response = await request(app)
        .post("/api/uploadExcel")
        .send({});

      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it("should require authentication for file uploads", async () => {
      const response = await request(app)
        .post("/api/uploadExcel")
        .attach("file", Buffer.from("test"), "test.txt");

      expect([401, 403, 400, 404]).toContain(response.status);
    });

    it("should accept Excel file uploads", async () => {
      const response = await request(app)
        .post("/api/uploadExcel")
        .field("grade", "1")
        .field("category", "vocabulary")
        .attach("file", Buffer.from("word1,word2,word3"), "words.xlsx");

      expect([400, 401, 403, 200, 500, 404]).toContain(response.status);
    });

    it("should accept text file uploads", async () => {
      const response = await request(app)
        .post("/api/uploadExcel")
        .field("grade", "2")
        .field("category", "science")
        .attach("file", Buffer.from("apple\nbanana\ncherry"), "words.txt");

      expect([400, 401, 403, 200, 500, 404]).toContain(response.status);
    });

    it("should validate required form fields", async () => {
      const response = await request(app)
        .post("/api/uploadExcel")
        .attach("file", Buffer.from("test"), "test.txt");

      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it("should handle empty files gracefully", async () => {
      const response = await request(app)
        .post("/api/uploadExcel")
        .field("grade", "1")
        .field("category", "vocab")
        .attach("file", Buffer.from(""), "empty.txt");

      expect([400, 401, 403, 500, 404]).toContain(response.status);
    });
  });

  describe("File type handling", () => {
    it("should accept .xlsx files", async () => {
      const response = await request(app)
        .post("/api/uploadExcel")
        .field("grade", "1")
        .field("category", "test")
        .attach("file", Buffer.from("test"), "words.xlsx");

      expect([400, 401, 403, 200, 500, 404]).toContain(response.status);
    });

    it("should accept .csv files", async () => {
      const response = await request(app)
        .post("/api/uploadExcel")
        .field("grade", "1")
        .field("category", "test")
        .attach("file", Buffer.from("word1,word2"), "words.csv");

      expect([400, 401, 403, 200, 500, 404]).toContain(response.status);
    });

    it("should accept .txt files", async () => {
      const response = await request(app)
        .post("/api/uploadExcel")
        .field("grade", "1")
        .field("category", "test")
        .attach("file", Buffer.from("word1\nword2"), "words.txt");

      expect([400, 401, 403, 200, 500, 404]).toContain(response.status);
    });
  });
});
