export interface Project {
  id: string;
  name: string;
  slug: string;
  type: "web" | "mobile";
  description: string | null;
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
  sectionId: string;
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
export interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  type: "web" | "mobile";
  description: string | null;
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
  section_id: string;
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
export function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    description: row.description,
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
