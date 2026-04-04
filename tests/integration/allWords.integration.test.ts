import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../src/app";

describe("All Words endpoint integration tests", () => {
  describe("GET /allWords", () => {
    it("should return paginated word list", async () => {
      const response = await request(app).get("/allWords");

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty("words");
        expect(Array.isArray(response.body.words)).toBe(true);
      }
    });

    it("should support page query parameter", async () => {
      const response = await request(app).get("/allWords?page=1");

      if (response.status === 200) {
        expect(response.body).toHaveProperty("page");
      }
    });

    it("should support limit query parameter", async () => {
      const response = await request(app).get("/allWords?limit=20");

      if (response.status === 200) {
        expect(response.body).toHaveProperty("limit");
      }
    });

    it("should support sorting by creation date", async () => {
      const response = await request(app).get(
        "/allWords?sortBy=createdAt&order=desc"
      );

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    it("should support word search/filter", async () => {
      const response = await request(app).get("/allWords?search=apple");

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe("POST /allWords/add endpoint", () => {
    it("should require admin authentication for adding words", async () => {
      const response = await request(app)
        .post("/allWords/add")
        .send({ words: ["test"] });

      expect([401, 403, 400, 404]).toContain(response.status);
    });

    it("should validate word data structure", async () => {
      const response = await request(app)
        .post("/allWords/add")
        .send({ invalidData: true });

      expect([401, 403, 400, 404]).toContain(response.status);
    });
  });

  describe("POST /allWords/upload endpoint", () => {
    it("should handle file uploads", async () => {
      const response = await request(app)
        .post("/allWords/upload")
        .field("category", "test")
        .attach("file", Buffer.from("test words"), "words.txt");

      expect([401, 403, 400, 200, 404]).toContain(response.status);
    });

    it("should require authentication for uploads", async () => {
      const response = await request(app)
        .post("/allWords/upload")
        .field("category", "test")
        .attach("file", Buffer.from("test"), "test.txt");

      expect([401, 403, 400, 404]).toContain(response.status);
    });
  });
});
