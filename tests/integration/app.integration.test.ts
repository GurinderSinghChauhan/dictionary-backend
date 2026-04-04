import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../src/app";

describe("app integration", () => {
  it("GET /hello returns hello response", async () => {
    const response = await request(app).get("/hello");
    expect(response.status).toBe(200);
    expect(response.text).toBe("Hello response!");
  });

  it("GET /docs serves swagger ui html", async () => {
    const response = await request(app).get("/docs/").redirects(1);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.text).toContain("Swagger UI");
  });

  it("GET /openapi.json returns openapi spec", async () => {
    const response = await request(app).get("/openapi.json");
    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.0.3");
    expect(response.body.info?.title).toBe("Dictionary Backend API");
  });
});
