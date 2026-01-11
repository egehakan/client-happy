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
  // Create tables first (without user_id on projects for backwards compatibility)
  await db.executeMultiple(`
    -- Users table (synced from env)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Projects table (user_id added via migration)
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
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_pages_project_id ON pages(project_id);
    CREATE INDEX IF NOT EXISTS idx_sections_page_id ON sections(page_id);
    CREATE INDEX IF NOT EXISTS idx_screenshots_section_id ON screenshots(section_id);
    CREATE INDEX IF NOT EXISTS idx_votes_screenshot_id ON votes(screenshot_id);
    CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
  `);

  // Migration: Add user_id column to projects if it doesn't exist
  try {
    await db.execute("SELECT user_id FROM projects LIMIT 1");
  } catch {
    // Column doesn't exist, add it
    await db.execute("ALTER TABLE projects ADD COLUMN user_id TEXT REFERENCES users(id)");
  }

  // Create index for user_id after ensuring column exists
  try {
    await db.execute("CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)");
  } catch {
    // Index might already exist or column doesn't exist yet, ignore
  }

  // Migration: Add email_verified column to users if it doesn't exist
  try {
    await db.execute("SELECT email_verified FROM users LIMIT 1");
  } catch {
    await db.execute("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0");
  }

  // Migration: Add verification_token column to users if it doesn't exist
  try {
    await db.execute("SELECT verification_token FROM users LIMIT 1");
  } catch {
    await db.execute("ALTER TABLE users ADD COLUMN verification_token TEXT");
  }

  // Migration: Add verification_token_expires column to users if it doesn't exist
  try {
    await db.execute("SELECT verification_token_expires FROM users LIMIT 1");
  } catch {
    await db.execute("ALTER TABLE users ADD COLUMN verification_token_expires TEXT");
  }

  // Create index for verification token
  try {
    await db.execute("CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token)");
  } catch {
    // Index might already exist
  }
}
