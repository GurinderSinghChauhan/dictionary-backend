import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

describe("Auth utilities", () => {
  describe("bcrypt password hashing", () => {
    it("should hash a password", async () => {
      const password = "testPassword123";
      const hash = await bcrypt.hash(password, 10);

      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it("should verify a correct password", async () => {
      const password = "testPassword123";
      const hash = await bcrypt.hash(password, 10);

      const isCorrect = await bcrypt.compare(password, hash);
      expect(isCorrect).toBe(true);
    });

    it("should reject an incorrect password", async () => {
      const password = "testPassword123";
      const wrongPassword = "wrongPassword456";
      const hash = await bcrypt.hash(password, 10);

      const isCorrect = await bcrypt.compare(wrongPassword, hash);
      expect(isCorrect).toBe(false);
    });
  });

  describe("JWT token generation", () => {
    it("should generate a token with correct payload structure", () => {
      const secret = "test-secret-key";
      const payload = { id: "user123", isAdmin: false };

      const token = jwt.sign(payload, secret, { expiresIn: "1d" });

      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");

      const decoded = jwt.decode(token);
      expect(decoded).toBeTruthy();
      expect(decoded.id).toBe("user123");
      expect(decoded.isAdmin).toBe(false);
    });

    it("should verify a valid token", () => {
      const secret = "test-secret-key";
      const payload = { id: "user123", isAdmin: true };

      const token = jwt.sign(payload, secret, { expiresIn: "1d" });
      const verified = jwt.verify(token, secret);

      expect(verified).toBeTruthy();
      expect(verified.id).toBe("user123");
      expect(verified.isAdmin).toBe(true);
    });

    it("should fail verification with wrong secret", () => {
      const secret = "test-secret-key";
      const wrongSecret = "wrong-secret-key";
      const payload = { id: "user123", isAdmin: false };

      const token = jwt.sign(payload, secret, { expiresIn: "1d" });

      expect(() => {
        jwt.verify(token, wrongSecret);
      }).toThrow();
    });
  });

  describe("Username normalization", () => {
    it("should normalize username by converting to lowercase and removing special chars", () => {
      const normalize = (name: string) =>
        name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

      expect(normalize("John Doe")).toBe("john-doe");
      expect(normalize("  Alice Smith  ")).toBe("alice-smith");
      expect(normalize("User@123!")).toBe("user-123");
      expect(normalize("---test---")).toBe("test");
    });
  });
});
