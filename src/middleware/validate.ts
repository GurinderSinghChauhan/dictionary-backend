import { NextFunction, Request, Response } from "express";
import { z, ZodTypeAny } from "zod";

const formatZodError = (error: z.ZodError) =>
  error.issues.map((issue) => ({
    message: issue.message,
    path: issue.path.join("."),
  }));

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

    req.body = result.data;
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

    req.query = result.data as Request["query"];
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

    req.params = result.data as Request["params"];
    next();
  };
