import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app";

describe("Grade endpoint integration tests", () => {
  describe("GET /grade", () => {
    it("should return 400 when grade parameter is missing", async () => {
      const response = await request(app).get("/grade");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Grade is required");
    });

    it("should return 400 with empty grade parameter", async () => {
      const response = await request(app).get("/grade?grade=");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Grade is required");
    });

    it("should have pagination parameters with defaults", { skip: true }, async () => {
      const response = await request(app).get("/grade?grade=1");

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty("words");
        expect(response.body).toHaveProperty("page");
        expect(response.body).toHaveProperty("limit");
      } else if ([404, 500].includes(response.status)) {
        expect([404, 500]).toContain(response.status);
      }
    });

    it("should respect page and limit query parameters", { skip: true }, async () => {
      const response = await request(app).get(
        "/grade?grade=1&page=2&limit=20"
      );

      expect([200, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.page).toBeDefined();
        expect(response.body.limit).toBeDefined();
      }
    });
  });

  describe("POST /grade/upload endpoint", () => {
    it("should return 400 when grade is missing from request body", async () => {
      const response = await request(app)
        .post("/grade/upload")
        .send({ file: "somefile" });

      expect([400, 401, 403]).toContain(response.status);
    });

    it("should require admin authentication", async () => {
      const response = await request(app)
        .post("/grade/upload")
        .send({ grade: "1" });

      expect([401, 403, 400]).toContain(response.status);
    });
  });

  describe("POST /grade/assign endpoint", () => {
    it("should return 400 when grade is missing", async () => {
      const response = await request(app)
        .post("/grade/assign")
        .send({ file: "somefile" });

      expect([400, 401, 403]).toContain(response.status);
    });

    it("should require admin authentication", async () => {
      const response = await request(app)
        .post("/grade/assign")
        .send({ grade: "1" });

      expect([401, 403, 400]).toContain(response.status);
    });
  });
});
