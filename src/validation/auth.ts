import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().trim().min(1, "username is required"),
  email: z.string().trim().email("valid email is required"),
  password: z.string().min(8, "password must be at least 8 characters"),
});

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().min(1).optional(),
    username: z.string().trim().min(1).optional(),
    password: z.string().min(1, "password is required"),
  })
  .refine((data) => Boolean(data.identifier || data.email || data.username), {
    message: "identifier, email, or username is required",
    path: ["identifier"],
  });

export const googleLoginSchema = z.object({
  idToken: z.string().trim().min(1, "idToken is required"),
});
