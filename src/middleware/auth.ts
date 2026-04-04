import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";

const getJwtSecret = (): Secret => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Environment variable JWT_SECRET must be set");
  }
  return secret;
};

export interface AuthenticatedRequest extends Request {
  user?: { id: string; isAdmin: boolean };
}

type JwtUserPayload = JwtPayload & {
  id?: string;
  isAdmin?: boolean;
};

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  if (!token) {
    res.status(401).json({ error: "Authorization token missing" });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtUserPayload;
    if (!payload?.id) {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }
    req.user = { id: payload.id, isAdmin: Boolean(payload.isAdmin) };
    next();
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("JWT_SECRET")
        ? "Auth is not configured on the server"
        : "Invalid or expired token";
    res.status(401).json({ error: message });
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  authenticateToken(req, res, () => {
    if (!req.user?.isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}
