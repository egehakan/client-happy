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

  // Migration: Create questions table
  try {
    await db.execute("SELECT id FROM questions LIMIT 1");
  } catch {
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        scope_type TEXT NOT NULL CHECK (scope_type IN ('website', 'page', 'section')),
        scope_id TEXT,
        field_type TEXT NOT NULL CHECK (field_type IN ('text', 'textarea', 'select', 'file', 'checkbox', 'date', 'color', 'url')),
        label TEXT NOT NULL,
        description TEXT,
        placeholder TEXT,
        options TEXT,
        is_required INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_questions_project_id ON questions(project_id);
      CREATE INDEX IF NOT EXISTS idx_questions_scope ON questions(scope_type, scope_id);
    `);
  }

  // Migration: Create question_responses table
  try {
    await db.execute("SELECT id FROM question_responses LIMIT 1");
  } catch {
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS question_responses (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        respondent_email TEXT NOT NULL,
        value TEXT,
        file_path TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(question_id, respondent_email)
      );
      CREATE INDEX IF NOT EXISTS idx_question_responses_question_id ON question_responses(question_id);
      CREATE INDEX IF NOT EXISTS idx_question_responses_email ON question_responses(respondent_email);
    `);
  }

  // Migration: Add max_file_count column to questions table
  try {
    await db.execute("SELECT max_file_count FROM questions LIMIT 1");
  } catch {
    await db.execute("ALTER TABLE questions ADD COLUMN max_file_count INTEGER DEFAULT 1");
  }

  // Migration: Add page_id column to screenshots for page-level screenshots
  try {
    await db.execute("SELECT page_id FROM screenshots LIMIT 1");
  } catch {
    await db.execute("ALTER TABLE screenshots ADD COLUMN page_id TEXT REFERENCES pages(id) ON DELETE CASCADE");
  }

  // Create index for screenshots.page_id
  try {
    await db.execute("CREATE INDEX IF NOT EXISTS idx_screenshots_page_id ON screenshots(page_id)");
  } catch {
    // Index might already exist
  }

  // Migration: Create question_groups table
  try {
    await db.execute("SELECT id FROM question_groups LIMIT 1");
  } catch {
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS question_groups (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_question_groups_project_id ON question_groups(project_id);
    `);
  }

  // Migration: Add group_id column to questions table
  try {
    await db.execute("SELECT group_id FROM questions LIMIT 1");
  } catch {
    await db.execute("ALTER TABLE questions ADD COLUMN group_id TEXT REFERENCES question_groups(id) ON DELETE SET NULL");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_questions_group_id ON questions(group_id)");
  }

  // Migration: Add scope_type and scope_id columns to question_groups table
  try {
    await db.execute("SELECT scope_type FROM question_groups LIMIT 1");
  } catch {
    await db.execute("ALTER TABLE question_groups ADD COLUMN scope_type TEXT CHECK (scope_type IN ('website', 'page', 'section'))");
    await db.execute("ALTER TABLE question_groups ADD COLUMN scope_id TEXT");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_question_groups_scope ON question_groups(scope_type, scope_id)");
  }

  // Migration: Make section_id nullable in screenshots table
  // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
  try {
    // Check if migration is needed by trying to insert a row with NULL section_id
    // If this fails with NOT NULL constraint, we need to migrate
    const testResult = await db.execute({
      sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name='screenshots'",
      args: [],
    });
    const createSql = (testResult.rows[0] as unknown as { sql: string })?.sql || "";

    // Only migrate if section_id is still NOT NULL
    if (createSql.includes("section_id TEXT NOT NULL")) {
      console.log("Migrating screenshots table to allow nullable section_id...");

      // Create new table with nullable section_id
      await db.execute(`
        CREATE TABLE screenshots_new (
          id TEXT PRIMARY KEY,
          section_id TEXT REFERENCES sections(id) ON DELETE CASCADE,
          page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
          title TEXT,
          description TEXT,
          source_type TEXT NOT NULL CHECK (source_type IN ('local', 'url')),
          file_path TEXT,
          external_url TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `);

      // Copy data from old table
      await db.execute(`
        INSERT INTO screenshots_new (id, section_id, page_id, title, description, source_type, file_path, external_url, sort_order, created_at, updated_at)
        SELECT id, section_id, page_id, title, description, source_type, file_path, external_url, sort_order, created_at, updated_at
        FROM screenshots
      `);

      // Drop old table
      await db.execute("DROP TABLE screenshots");

      // Rename new table
      await db.execute("ALTER TABLE screenshots_new RENAME TO screenshots");

      // Recreate indexes
      await db.execute("CREATE INDEX IF NOT EXISTS idx_screenshots_section_id ON screenshots(section_id)");
      await db.execute("CREATE INDEX IF NOT EXISTS idx_screenshots_page_id ON screenshots(page_id)");

      console.log("Screenshots table migration complete.");
    }
  } catch (migrationError) {
    console.error("Screenshots table migration check/run failed:", migrationError);
  }
}
