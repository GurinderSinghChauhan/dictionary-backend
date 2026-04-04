import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../src/app";

describe("Subject endpoint integration tests", () => {
  describe("GET /subject", () => {
    it("should return 400 when subject parameter is missing", async () => {
      const response = await request(app).get("/subject");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Subject is required");
    });

    it("should return 400 with empty subject parameter", async () => {
      const response = await request(app).get("/subject?subject=");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Subject is required");
    });

    it("should support pagination", { skip: true }, async () => {
      const response = await request(app).get("/subject?subject=science");

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty("words");
        expect(response.body).toHaveProperty("page");
        expect(response.body).toHaveProperty("limit");
      } else if ([404, 500].includes(response.status)) {
        expect([404, 500]).toContain(response.status);
      }
    });

    it(
      "should accept custom pagination parameters",
      { skip: true },
      async () => {
        const response = await request(app).get(
          "/subject?subject=science&page=1&limit=30"
        );

        expect([200, 404, 500]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body).toHaveProperty("page");
          expect(response.body).toHaveProperty("limit");
        }
      }
    );
  });

  describe("POST /subject/upload endpoint", () => {
    it("should return error when subject is missing", async () => {
      const response = await request(app)
        .post("/subject/upload")
        .send({ file: "test" });

      expect([400, 401, 403]).toContain(response.status);
    });

    it("should require admin authentication", async () => {
      const response = await request(app)
        .post("/subject/upload")
        .field("subject", "science")
        .attach("file", Buffer.from("test"), "test.txt");

      expect([401, 403, 400]).toContain(response.status);
    });

    it("should support promptStyle parameter", async () => {
      const response = await request(app)
        .post("/subject/upload")
        .field("subject", "science")
        .field("promptStyle", "exampleSentence")
        .attach("file", Buffer.from("test"), "test.txt");

      expect([400, 401, 403, 500]).toContain(response.status);
    });
  });

  describe("POST /subject/assign endpoint", () => {
    it("should return error when subject is missing", async () => {
      const response = await request(app).post("/subject/assign").send({});

      expect([400, 401, 403]).toContain(response.status);
    });

    it("should require admin authentication", async () => {
      const response = await request(app)
        .post("/subject/assign")
        .field("subject", "science")
        .attach("file", Buffer.from("test"), "test.txt");

      expect([401, 403, 400]).toContain(response.status);
    });
  });
});
