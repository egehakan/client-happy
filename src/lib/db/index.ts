import { createClient, type Client, type InStatement, type ResultSet } from "@libsql/client";

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    if (!process.env.TURSO_DATABASE_URL) {
      throw new Error("TURSO_DATABASE_URL environment variable is not set");
    }
    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

export const db = {
  execute: (stmt: InStatement): Promise<ResultSet> => getClient().execute(stmt),
  executeMultiple: (sql: string): Promise<void> => getClient().executeMultiple(sql),
};

export async function initializeSchema(): Promise<void> {
  await db.executeMultiple(`
    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('web', 'mobile')),
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Pages table
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Sections table
    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Screenshots table
    CREATE TABLE IF NOT EXISTS screenshots (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      title TEXT,
      description TEXT,
      source_type TEXT NOT NULL CHECK (source_type IN ('local', 'url')),
      file_path TEXT,
      external_url TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Votes table
    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      screenshot_id TEXT NOT NULL REFERENCES screenshots(id) ON DELETE CASCADE,
      vote TEXT NOT NULL CHECK (vote IN ('yes', 'mid', 'no')),
      comment TEXT,
      voter_identifier TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_pages_project_id ON pages(project_id);
    CREATE INDEX IF NOT EXISTS idx_sections_page_id ON sections(page_id);
    CREATE INDEX IF NOT EXISTS idx_screenshots_section_id ON screenshots(section_id);
    CREATE INDEX IF NOT EXISTS idx_votes_screenshot_id ON votes(screenshot_id);
    CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
  `);
}
