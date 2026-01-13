export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  type: "web" | "mobile";
  description: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  pageId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Screenshot {
  id: string;
  sectionId: string | null;
  pageId: string | null;
  title: string | null;
  description: string | null;
  sourceType: "local" | "url";
  filePath: string | null;
  externalUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Vote {
  id: string;
  screenshotId: string;
  vote: "yes" | "mid" | "no";
  comment: string | null;
  voterIdentifier: string | null;
  createdAt: string;
}

export interface VotesSummary {
  yes: number;
  mid: number;
  no: number;
}

export interface ScreenshotWithVotes extends Screenshot {
  votes: Vote[];
  votesSummary: VotesSummary;
}

export interface SectionWithScreenshots extends Section {
  screenshots: ScreenshotWithVotes[];
}

export interface PageWithSections extends Page {
  sections: SectionWithScreenshots[];
}

export interface ProjectWithPages extends Project {
  pages: PageWithSections[];
}

// Database row types (snake_case from SQLite)
export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  email_verified: number;
  verification_token: string | null;
  verification_token_expires: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  type: "web" | "mobile";
  description: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SectionRow {
  id: string;
  page_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ScreenshotRow {
  id: string;
  section_id: string | null;
  page_id: string | null;
  title: string | null;
  description: string | null;
  source_type: "local" | "url";
  file_path: string | null;
  external_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VoteRow {
  id: string;
  screenshot_id: string;
  vote: "yes" | "mid" | "no";
  comment: string | null;
  voter_identifier: string | null;
  created_at: string;
}

// Utility functions to convert between row and interface types
export function userFromRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    emailVerified: row.email_verified === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    description: row.description,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function pageFromRow(row: PageRow): Page {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function sectionFromRow(row: SectionRow): Section {
  return {
    id: row.id,
    pageId: row.page_id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function screenshotFromRow(row: ScreenshotRow): Screenshot {
  return {
    id: row.id,
    sectionId: row.section_id,
    pageId: row.page_id,
    title: row.title,
    description: row.description,
    sourceType: row.source_type,
    filePath: row.file_path,
    externalUrl: row.external_url,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function voteFromRow(row: VoteRow): Vote {
  return {
    id: row.id,
    screenshotId: row.screenshot_id,
    vote: row.vote,
    comment: row.comment,
    voterIdentifier: row.voter_identifier,
    createdAt: row.created_at,
  };
}

// Question Group types
export type GroupScopeType = "website" | "page" | "section";

export interface QuestionGroup {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  scopeType: GroupScopeType | null;
  scopeId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionGroupRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  scope_type: GroupScopeType | null;
  scope_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function questionGroupFromRow(row: QuestionGroupRow): QuestionGroup {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Question types
export type QuestionFieldType =
  | "text"
  | "textarea"
  | "select"
  | "file"
  | "checkbox"
  | "date"
  | "color"
  | "url";

export type QuestionScopeType = "website" | "page" | "section";

export interface Question {
  id: string;
  projectId: string;
  groupId: string | null;
  scopeType: QuestionScopeType;
  scopeId: string | null;
  fieldType: QuestionFieldType;
  label: string;
  description: string | null;
  placeholder: string | null;
  options: string[] | null;
  isRequired: boolean;
  maxFileCount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionResponse {
  id: string;
  questionId: string;
  respondentEmail: string;
  value: string | null;
  filePath: string | null;
  createdAt: string;
  updatedAt: string;
}

// Question row types (snake_case from SQLite)
export interface QuestionRow {
  id: string;
  project_id: string;
  group_id: string | null;
  scope_type: QuestionScopeType;
  scope_id: string | null;
  field_type: QuestionFieldType;
  label: string;
  description: string | null;
  placeholder: string | null;
  options: string | null;
  is_required: number;
  max_file_count: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionResponseRow {
  id: string;
  question_id: string;
  respondent_email: string;
  value: string | null;
  file_path: string | null;
  created_at: string;
  updated_at: string;
}

// Question converter functions
export function questionFromRow(row: QuestionRow): Question {
  return {
    id: row.id,
    projectId: row.project_id,
    groupId: row.group_id,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    fieldType: row.field_type,
    label: row.label,
    description: row.description,
    placeholder: row.placeholder,
    options: row.options ? JSON.parse(row.options) : null,
    isRequired: row.is_required === 1,
    maxFileCount: row.max_file_count ?? 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function questionResponseFromRow(row: QuestionResponseRow): QuestionResponse {
  return {
    id: row.id,
    questionId: row.question_id,
    respondentEmail: row.respondent_email,
    value: row.value,
    filePath: row.file_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Extended types for questionnaire display
export interface QuestionWithScope extends Question {
  scopeName?: string;
  pageName?: string;
}

export interface QuestionGroupWithQuestions extends QuestionGroup {
  questions: Question[];
}
