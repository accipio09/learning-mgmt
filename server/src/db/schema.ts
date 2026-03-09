import db from "./client";

export function initializeDatabase() {
  // Check if old flashcards table exists (needs migration)
  const oldTableExists = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='flashcards'"
    )
    .get();

  if (oldTableExists) {
    migrateToNodes();
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS briefs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      language TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      structure TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS node_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      week INTEGER NOT NULL,
      generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, week)
    );

    CREATE TABLE IF NOT EXISTS learning_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      set_id INTEGER REFERENCES node_sets(id),
      node_type TEXT NOT NULL DEFAULT 'flashcard',
      content TEXT NOT NULL,
      language TEXT NOT NULL,
      source_brief_id INTEGER REFERENCES briefs(id),
      source_bullet TEXT,
      created_via TEXT DEFAULT 'auto'
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id INTEGER UNIQUE REFERENCES learning_nodes(id),
      ease REAL DEFAULT 2.5,
      interval INTEGER DEFAULT 1,
      repetitions INTEGER DEFAULT 0,
      due_date TEXT NOT NULL,
      last_reviewed TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brief_id INTEGER NOT NULL REFERENCES briefs(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS review_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id INTEGER NOT NULL REFERENCES learning_nodes(id),
      rating INTEGER NOT NULL,
      ease_after REAL NOT NULL,
      interval_after INTEGER NOT NULL,
      repetitions_after INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_briefs_date ON briefs(date);
    CREATE INDEX IF NOT EXISTS idx_learning_nodes_set ON learning_nodes(set_id);
    CREATE INDEX IF NOT EXISTS idx_learning_nodes_type ON learning_nodes(node_type);
    CREATE INDEX IF NOT EXISTS idx_reviews_due ON reviews(due_date);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_brief ON chat_messages(brief_id);
    CREATE INDEX IF NOT EXISTS idx_review_log_created ON review_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_review_log_node ON review_log(node_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
  `);

  // Migration: add name column to node_sets
  const hasNameCol = db
    .prepare("PRAGMA table_info(node_sets)")
    .all()
    .some((col: any) => col.name === "name");

  if (!hasNameCol) {
    db.exec("ALTER TABLE node_sets ADD COLUMN name TEXT");
  }

  // Migration: add created_at column to learning_nodes
  const hasCreatedAt = db
    .prepare("PRAGMA table_info(learning_nodes)")
    .all()
    .some((col: any) => col.name === "created_at");

  if (!hasCreatedAt) {
    db.exec(`
      ALTER TABLE learning_nodes ADD COLUMN created_at TEXT;

      -- Backfill from node_sets.generated_at
      UPDATE learning_nodes
      SET created_at = (
        SELECT ns.generated_at FROM node_sets ns WHERE ns.id = learning_nodes.set_id
      )
      WHERE set_id IS NOT NULL;

      -- Auto-fill created_at on future inserts
      CREATE TRIGGER IF NOT EXISTS set_learning_node_created_at
      AFTER INSERT ON learning_nodes
      WHEN NEW.created_at IS NULL
      BEGIN
        UPDATE learning_nodes SET created_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  }

  // Index on created_at — must be after the migration that adds the column
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_learning_nodes_created ON learning_nodes(created_at)"
  );
}

function migrateToNodes() {
  const migrate = db.transaction(() => {
    // Create new tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS node_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        week INTEGER NOT NULL,
        generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, week)
      );

      CREATE TABLE IF NOT EXISTS learning_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        set_id INTEGER REFERENCES node_sets(id),
        node_type TEXT NOT NULL DEFAULT 'flashcard',
        content TEXT NOT NULL,
        language TEXT NOT NULL,
        source_brief_id INTEGER REFERENCES briefs(id),
        source_bullet TEXT,
        created_via TEXT DEFAULT 'auto'
      );
    `);

    // Migrate flashcard_sets → node_sets
    db.exec(`
      INSERT INTO node_sets (id, year, week, generated_at)
      SELECT id, year, week, generated_at FROM flashcard_sets
    `);

    // Migrate flashcards → learning_nodes (convert front/back to JSON content)
    const oldCards = db
      .prepare("SELECT * FROM flashcards")
      .all() as Array<{
      id: number;
      set_id: number;
      front: string;
      back: string;
      language: string;
      source_brief_id: number;
      source_bullet: string;
      created_via: string;
    }>;

    const insertNode = db.prepare(
      `INSERT INTO learning_nodes (id, set_id, node_type, content, language, source_brief_id, source_bullet, created_via)
       VALUES (?, ?, 'flashcard', ?, ?, ?, ?, ?)`
    );

    for (const card of oldCards) {
      insertNode.run(
        card.id,
        card.set_id,
        JSON.stringify({ front: card.front, back: card.back }),
        card.language,
        card.source_brief_id,
        card.source_bullet,
        card.created_via
      );
    }

    // Migrate reviews: create new table with node_id, copy data
    db.exec(`
      CREATE TABLE IF NOT EXISTS reviews_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id INTEGER UNIQUE REFERENCES learning_nodes(id),
        ease REAL DEFAULT 2.5,
        interval INTEGER DEFAULT 1,
        repetitions INTEGER DEFAULT 0,
        due_date TEXT NOT NULL,
        last_reviewed TEXT
      );

      INSERT INTO reviews_new (id, node_id, ease, interval, repetitions, due_date, last_reviewed)
      SELECT id, card_id, ease, interval, repetitions, due_date, last_reviewed FROM reviews;

      DROP TABLE reviews;
      ALTER TABLE reviews_new RENAME TO reviews;
    `);

    // Drop old tables
    db.exec(`
      DROP TABLE flashcards;
      DROP TABLE flashcard_sets;
    `);
  });

  migrate();
}
