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
    sectionId: z.string().min(1).optional().nullable(),
    pageId: z.string().min(1).optional().nullable(),
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
  )
  .refine(
    (data) => {
      // Must have either sectionId or pageId (but not both)
      return (!!data.sectionId && !data.pageId) || (!data.sectionId && !!data.pageId);
    },
    {
      message: "Either sectionId or pageId must be provided (but not both)",
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
  voterIdentifier: z.string().email("Please enter a valid email address"),
});

// Auth validators
export const registerSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email address"),
});

// Question field types
export const questionFieldTypes = z.enum([
  "text",
  "textarea",
  "select",
  "file",
  "checkbox",
  "date",
  "color",
  "url",
]);

export const questionScopeTypes = z.enum(["website", "page", "section"]);

// Create question schema
export const createQuestionSchema = z
  .object({
    projectId: z.string().min(1, "Project ID is required"),
    scopeType: questionScopeTypes,
    scopeId: z.string().optional().nullable(),
    fieldType: questionFieldTypes,
    label: z.string().min(1, "Label is required").max(200),
    description: z.string().max(500).optional(),
    placeholder: z.string().max(200).optional(),
    options: z.array(z.string().min(1).max(100)).optional(),
    isRequired: z.boolean().default(false),
    maxFileCount: z.number().int().min(1).max(20).default(1),
  })
  .refine(
    (data) => {
      if (data.scopeType === "page" || data.scopeType === "section") {
        return !!data.scopeId;
      }
      return true;
    },
    { message: "scopeId is required for page and section scopes", path: ["scopeId"] }
  )
  .refine(
    (data) => {
      if (data.fieldType === "select" || data.fieldType === "checkbox") {
        return data.options && data.options.length > 0;
      }
      return true;
    },
    { message: "Options are required for select and checkbox field types", path: ["options"] }
  );

// Update question schema
export const updateQuestionSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  placeholder: z.string().max(200).nullable().optional(),
  options: z.array(z.string().min(1).max(100)).nullable().optional(),
  isRequired: z.boolean().optional(),
  maxFileCount: z.number().int().min(1).max(20).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// Submit questionnaire response schema
export const submitQuestionnaireSchema = z.object({
  responses: z.array(
    z.object({
      questionId: z.string().min(1),
      value: z.string().max(10000).optional().nullable(),
      filePath: z.string().optional().nullable(),
    })
  ),
  respondentEmail: z.string().email("Please enter a valid email address"),
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
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type SubmitQuestionnaireInput = z.infer<typeof submitQuestionnaireSchema>;
