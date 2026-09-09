import { z } from "zod";

/**
 * Shared client + server validation. Every schema here is imported both by
 * react-hook-form (via @hookform/resolvers/zod) on the client and by the
 * Server Action that ultimately performs the mutation, so validation logic
 * and its messages exist in exactly one place.
 */

export const asinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{10}$/, { error: "ASIN must be exactly 10 letters or numbers." });

// Accepts any amazon.<tld> host (with or without www.), HTTPS only.
export const amazonUrlSchema = z
  .string()
  .trim()
  .pipe(
    z.url({
      protocol: /^https$/,
      hostname: /^(www\.)?amazon\.[a-z.]{2,}$/i,
      error: "Enter a valid HTTPS amazon.* product URL.",
    }),
  );

export const emailSchema = z.email({ error: "Enter a valid email address." });

// --- Auth ---------------------------------------------------------------

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Password is required." }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, { error: "Password must be at least 8 characters." }),
    confirmPassword: z.string().min(1, { error: "Confirm your new password." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Current password is required." }),
    newPassword: z.string().min(8, { error: "Password must be at least 8 characters." }),
    confirmPassword: z.string().min(1, { error: "Confirm your new password." }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// --- Products -------------------------------------------------------------

export const productSchema = z.object({
  asin: asinSchema,
  title: z.string().trim().min(1, { error: "Product title is required." }).max(300),
  notifyEnabled: z.boolean(),
  imagePath: z.string().trim().min(1).nullable().optional(),
});
export type ProductInput = z.infer<typeof productSchema>;

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const imageFileSchema = z
  .instanceof(File)
  .refine((file) => ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number]), {
    error: "Only JPG, PNG and WebP images are allowed.",
  })
  .refine((file) => file.size <= MAX_IMAGE_BYTES, {
    error: "Image must be 5 MB or smaller.",
  });

// --- Competitors ------------------------------------------------------------

export const competitorSchema = z.object({
  asin: asinSchema,
  title: z.string().trim().min(1, { error: "Competitor title is required." }).max(300),
  amazonUrl: amazonUrlSchema,
});
export type CompetitorInput = z.infer<typeof competitorSchema>;

export const MAX_COMPETITORS_PER_PRODUCT = 20;

// --- Settings ---------------------------------------------------------------

export const settingsSchema = z.object({
  companyName: z.string().trim().max(200).nullable().optional(),
  reportEmail: emailSchema,
  dailyReportsEnabled: z.boolean(),
  timezone: z.string().trim().min(1, { error: "Select a timezone." }),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

// --- Team ---------------------------------------------------------------

export const createTeamMemberSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, { error: "Password must be at least 8 characters." }),
});
export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;

// --- Scraper callback ---------------------------------------------------

export const scraperCallbackSchema = z.object({
  reportRunId: z.uuid(),
  externalJobId: z.string().min(1).max(128).nullable().optional(),
  status: z.enum(["processing", "completed", "failed"]),
  startedAt: z.iso.datetime().nullable().optional(),
  completedAt: z.iso.datetime().nullable().optional(),
  reportFileUrl: z.url().nullable().optional(),
  errorMessage: z.string().max(2000).nullable().optional(),
  resultData: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type ScraperCallbackInput = z.infer<typeof scraperCallbackSchema>;

export const scraperAckSchema = z.object({
  accepted: z.literal(true),
  jobId: z.string().min(1).max(128),
  queuedAt: z.iso.datetime().nullable().optional(),
  estimatedSeconds: z.number().int().nonnegative().nullable().optional(),
  message: z.string().max(500).nullable().optional(),
});
export type ScraperAck = z.infer<typeof scraperAckSchema>;
