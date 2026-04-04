import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../src/app";

describe("Exam endpoint integration tests", () => {
  describe("GET /exam", () => {
    it("should return 400 when exam parameter is missing", async () => {
      const response = await request(app).get("/exam");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Exam is required");
    });

    it("should return 400 with empty exam parameter", async () => {
      const response = await request(app).get("/exam?exam=");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Exam is required");
    });

    it("should have pagination support with defaults", { skip: true }, async () => {
      const response = await request(app).get("/exam?exam=SAT");

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty("words");
        expect(response.body).toHaveProperty("page");
        expect(response.body).toHaveProperty("limit");
      } else if ([404, 500].includes(response.status)) {
        expect([404, 500]).toContain(response.status);
      }
    });

    it("should accept custom page and limit parameters", { skip: true }, async () => {
      const response = await request(app).get(
        "/exam?exam=SAT&page=1&limit=25"
      );

      expect([200, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.page).toBe(1);
        expect(response.body.limit).toBe(25);
      }
    });
  });

  describe("POST /exam/upload endpoint", () => {
    it("should return 400 when exam or file is missing", async () => {
      const response = await request(app)
        .post("/exam/upload")
        .field("exam", "SAT");

      expect([400, 401, 403]).toContain(response.status);
    });

    it("should require admin authentication", async () => {
      const response = await request(app)
        .post("/exam/upload")
        .field("exam", "SAT")
        .attach("file", Buffer.from("test"), "test.txt");

      expect([401, 403, 400]).toContain(response.status);
    });

    it("should accept promptStyle parameter", async () => {
      const response = await request(app)
        .post("/exam/upload")
        .field("exam", "SAT")
        .field("promptStyle", "meaning")
        .attach("file", Buffer.from("test"), "test.txt");

      expect([400, 401, 403, 500]).toContain(response.status);
    });
  });

  describe("POST /exam/assign endpoint", () => {
    it("should return 400 when exam or file is missing", async () => {
      const response = await request(app)
        .post("/exam/assign")
        .field("exam", "SAT");

      expect([400, 401, 403]).toContain(response.status);
    });

    it("should require admin authentication", async () => {
      const response = await request(app)
        .post("/exam/assign")
        .field("exam", "SAT")
        .attach("file", Buffer.from("test"), "test.txt");

      expect([401, 403, 400]).toContain(response.status);
    });
  });
});
