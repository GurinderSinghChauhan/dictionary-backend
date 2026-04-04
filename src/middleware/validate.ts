import { NextFunction, Request, Response } from "express";
import { z, ZodTypeAny } from "zod";

const formatZodError = (error: z.ZodError) =>
  error.issues.map((issue) => ({
    message: issue.message,
    path: issue.path.join("."),
  }));

const replaceObjectValues = <T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>
) => {
  for (const key of Object.keys(target)) {
    delete target[key];
  }

  Object.assign(target, source);
};

export const validateBody =
  <T extends ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: formatZodError(result.error),
      });
      return;
    }

    if (req.body && typeof req.body === "object") {
      replaceObjectValues(req.body as Record<string, unknown>, result.data);
    } else {
      req.body = result.data;
    }
    next();
  };

export const validateQuery =
  <T extends ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        error: "Invalid query parameters",
        details: formatZodError(result.error),
      });
      return;
    }

    replaceObjectValues(
      req.query as Record<string, unknown>,
      result.data as Record<string, unknown>
    );
    next();
  };

export const validateParams =
  <T extends ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        error: "Invalid route parameters",
        details: formatZodError(result.error),
      });
      return;
    }

    replaceObjectValues(
      req.params as Record<string, unknown>,
      result.data as Record<string, unknown>
    );
    next();
  };
