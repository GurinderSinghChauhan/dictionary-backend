import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { authenticateToken, type AuthenticatedRequest } from "../middleware/auth";
import User from "../models/user";

const router = express.Router();

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Environment variable JWT_SECRET is required for auth");
  }
  return secret;
};

const getGoogleAudiences = () =>
  [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
  ].filter((value): value is string => Boolean(value));

const googleClient = new OAuth2Client();

const signToken = (user: { _id: unknown; isAdmin: boolean }) =>
  jwt.sign({ id: user._id, isAdmin: user.isAdmin }, getJwtSecret(), {
    expiresIn: "1d",
  });

const serializeUser = (user: {
  _id: unknown;
  username: string;
  email: string;
  isAdmin: boolean;
}) => ({
  id: String(user._id),
  username: user.username,
  email: user.email,
  isAdmin: user.isAdmin,
});

const findPublicUserById = (id: unknown) =>
  User.findById(id).select("_id username email isAdmin");

const buildUniqueUsername = async (baseName: string) => {
  const normalizedBase = baseName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const fallbackBase = normalizedBase || "google-user";

  let candidate = fallbackBase;
  let counter = 1;

  while (await User.findOne({ username: candidate })) {
    counter += 1;
    candidate = `${fallbackBase}-${counter}`.slice(0, 32);
  }

  return candidate;
};

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: User already exists
 */
// Register Route
router.post("/register", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");

    if (!username || !email || !password) {
      res.status(400).json({
        message: "All fields are required: username, email, and password",
      });
      return;
    }

    const [existingEmail, existingUsername] = await Promise.all([
      User.findOne({ email }).lean(),
      User.findOne({ username }).lean(),
    ]);

    if (existingEmail) {
      res.status(409).json({ message: "User already exists with this email" });
      return;
    }

    if (existingUsername) {
      res.status(409).json({ message: "Username is already taken" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      isAdmin: false,
      authProvider: "local",
    });

    const token = signToken(user);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: serializeUser(user),
    });
  } catch (err: any) {
    console.error("Registration Error:", err);
    res.status(500).json({
      message:
        "Something went wrong during registration. Please try again later.",
      error: err.message,
    });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login user with email or username
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email or username
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged in successfully
 *       401:
 *         description: Invalid credentials
 *       404:
 *         description: User not found
 */
// Login Route
router.post("/login", async (req: Request, res: Response) => {
  try {
    const identifier = String(
      req.body?.identifier || req.body?.email || req.body?.username || ""
    )
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");

    if (!identifier || !password) {
      res
        .status(400)
        .json({ message: "Email/Username and password are required" });
      return;
    }

    // Find user by email or username
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (!user.password) {
      res.status(400).json({
        message:
          "This account uses Google login. Please sign in with Google.",
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const token = signToken(user);

    res.status(200).json({
      token,
      user: serializeUser(user),
    });
    return;
  } catch (err: any) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * @swagger
 * /auth/google:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login via Google ID token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged in successfully
 *       400:
 *         description: Invalid Google token
 *       401:
 *         description: Google authentication failed
 */
router.post("/google", async (req: Request, res: Response) => {
  try {
    const idToken = String(req.body?.idToken || "").trim();
    if (!idToken) {
      res.status(400).json({ message: "Google ID token is required" });
      return;
    }

    const audiences = getGoogleAudiences();
    if (!audiences.length) {
      res.status(500).json({
        message: "Google login is not configured on the server",
      });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: audiences,
    });
    const payload = ticket.getPayload();

    if (!payload?.email) {
      res.status(400).json({ message: "Google account email is missing" });
      return;
    }

    const email = payload.email.trim().toLowerCase();
    let user = await User.findOne({ email });

    if (!user) {
      const username = await buildUniqueUsername(payload.name || email);
      user = await User.create({
        username,
        email,
        password: "",
        isAdmin: false,
        authProvider: "google",
      });
    } else if (user.authProvider !== "google") {
      user.authProvider = "google";
      await user.save();
    }

    const token = signToken(user);

    res.status(200).json({
      token,
      user: serializeUser(user),
    });
  } catch (err: any) {
    console.error("Google Login Error:", err);
    res.status(401).json({
      message: "Google authentication failed",
      error: err.message,
    });
  }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get current authenticated user
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current user details
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get(
  "/me",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await findPublicUserById(req.user?.id);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      res.status(200).json({ user: serializeUser(user) });
    } catch (err: any) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

router.get(
  "/profile",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await findPublicUserById(req.user?.id);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      res.status(200).json({ user: serializeUser(user) });
    } catch (err: any) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

router.post(
  "/refresh",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await findPublicUserById(req.user?.id);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const token = signToken(user);
      res.status(200).json({ token, user: serializeUser(user) });
    } catch (err: any) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

router.post("/logout", async (_req: Request, res: Response) => {
  res.status(200).json({ success: true });
});

export default router;
