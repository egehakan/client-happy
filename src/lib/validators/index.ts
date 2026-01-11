import { z } from "zod";

// Project validators
export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["web", "mobile"]),
  description: z.string().max(500).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and dashes only")
    .optional(),
  type: z.enum(["web", "mobile"]).optional(),
  description: z.string().max(500).nullable().optional(),
});

// Page validators
export const createPageSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
});

export const updatePageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// Section validators
export const createSectionSchema = z.object({
  pageId: z.string().min(1, "Page ID is required"),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
});

export const updateSectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// Screenshot validators
export const createScreenshotSchema = z
  .object({
    sectionId: z.string().min(1, "Section ID is required"),
    title: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    sourceType: z.enum(["local", "url"]),
    filePath: z.string().optional(),
    externalUrl: z.string().url("Must be a valid URL").optional(),
  })
  .refine(
    (data) => {
      if (data.sourceType === "local") return !!data.filePath;
      if (data.sourceType === "url") return !!data.externalUrl;
      return false;
    },
    {
      message: "Either filePath or externalUrl must be provided based on sourceType",
    }
  );

export const updateScreenshotSchema = z.object({
  title: z.string().max(100).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// Vote validators
export const createVoteSchema = z.object({
  screenshotId: z.string().min(1, "Screenshot ID is required"),
  vote: z.enum(["yes", "mid", "no"]),
  comment: z.string().max(1000).optional(),
  voterIdentifier: z.string().max(100).optional(),
});

// Bulk vote submission
export const submitVotesSchema = z.object({
  votes: z.array(
    z.object({
      screenshotId: z.string().min(1),
      vote: z.enum(["yes", "mid", "no"]),
      comment: z.string().max(1000).optional(),
    })
  ),
  voterIdentifier: z.string().max(100).optional(),
});

// Type exports
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type CreateScreenshotInput = z.infer<typeof createScreenshotSchema>;
export type UpdateScreenshotInput = z.infer<typeof updateScreenshotSchema>;
export type CreateVoteInput = z.infer<typeof createVoteSchema>;
export type SubmitVotesInput = z.infer<typeof submitVotesSchema>;
