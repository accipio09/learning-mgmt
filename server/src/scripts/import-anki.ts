#!/usr/bin/env tsx
/**
 * Import Anki .apkg into learning-mgmt
 *
 * Usage:
 *   npx tsx server/src/scripts/import-anki.ts <file.apkg> --map "DeckName=lang,Other=lang" [--dry-run]
 *
 * Example:
 *   npx tsx server/src/scripts/import-anki.ts cards.apkg --map "Deutsch=de,English=en" --dry-run
 */

import AdmZip from "adm-zip";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// --- Config ---

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const DB_PATH = path.join(PROJECT_ROOT, "data", "learning-mgmt.db");

// --- CLI args ---

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const apkgPath = args.find((a) => !a.startsWith("--"));
const mapIndex = args.indexOf("--map");
const mapArg = mapIndex !== -1 ? args[mapIndex + 1] : undefined;

if (!apkgPath || !mapArg) {
  console.error(
    'Usage: npx tsx server/src/scripts/import-anki.ts <file.apkg> --map "Deck=lang,..." [--dry-run]'
  );
  process.exit(1);
}

// Parse deck→language mapping from CLI
const DECK_LANG: Record<string, string> = {};
for (const pair of mapArg.split(",")) {
  const [deck, lang] = pair.split("=");
  if (deck && lang) DECK_LANG[deck.trim()] = lang.trim();
}

if (Object.keys(DECK_LANG).length === 0) {
  console.error("No valid deck→language mappings found. Format: --map \"DeckName=lang,Other=lang\"");
  process.exit(1);
}

if (!fs.existsSync(apkgPath)) {
  console.error(`File not found: ${apkgPath}`);
  process.exit(1);
}

// --- Step 1: Extract .apkg ---

console.log(`\n📦 Extracting ${path.basename(apkgPath)}...`);

const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "anki-import-"));
const zip = new AdmZip(apkgPath);
zip.extractAllTo(tmpDir, true);

// --- Step 2: Find and decompress the Anki DB ---

let ankiDbPath: string;

// AdmZip auto-decompresses zstd, so collection.anki21b becomes collection.anki21
const anki21Path = path.join(tmpDir, "collection.anki21");
const anki21bPath = path.join(tmpDir, "collection.anki21b");
const anki2Path = path.join(tmpDir, "collection.anki2");

if (fs.existsSync(anki21Path)) {
  ankiDbPath = anki21Path;
} else if (fs.existsSync(anki21bPath)) {
  ankiDbPath = anki21bPath;
} else if (fs.existsSync(anki2Path)) {
  ankiDbPath = anki2Path;
} else {
  console.error("No Anki collection database found in .apkg");
  process.exit(1);
}

// --- Step 3: Read Anki DB ---

console.log("📖 Reading Anki database...");

const ankiDb = new Database(ankiDbPath, { readonly: true });

// Get decks
interface AnkiDeck {
  id: number;
  name: string;
}

let decks: AnkiDeck[];

// anki21b format has a `decks` table; legacy has JSON in `col`
const hasDecksTable = ankiDb
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='decks'")
  .get();

if (hasDecksTable) {
  decks = ankiDb.prepare("SELECT id, name FROM decks").all() as AnkiDeck[];
} else {
  const col = ankiDb.prepare("SELECT decks FROM col").get() as { decks: string };
  const decksJson = JSON.parse(col.decks);
  decks = Object.values(decksJson).map((d: any) => ({ id: d.id, name: d.name }));
}

const deckMap = new Map(decks.map((d) => [d.id, d.name]));

// Auto-detect collection creation date for due date calculation
const colRow = ankiDb.prepare("SELECT crt FROM col").get() as { crt: number } | undefined;
const COLLECTION_EPOCH = colRow
  ? new Date(colRow.crt * 1000)
  : new Date();

// Get notes
interface AnkiNote {
  id: number;
  flds: string;
}

const notes = ankiDb.prepare("SELECT id, flds FROM notes").all() as AnkiNote[];
const noteMap = new Map(notes.map((n) => [n.id, n]));

// Get cards with SM-2 data
interface AnkiCard {
  id: number;
  nid: number;
  did: number;
  type: number;
  ivl: number;
  factor: number;
  reps: number;
  due: number;
}

const cards = ankiDb
  .prepare("SELECT rowid as id, nid, did, type, ivl, factor, reps, due FROM cards")
  .all() as AnkiCard[];

ankiDb.close();

// --- Step 4: Transform ---

console.log("🔄 Transforming cards...\n");

interface ImportCard {
  front: string;
  back: string;
  language: string;
  deckName: string;
  ease: number;
  interval: number;
  repetitions: number;
  dueDate: string;
}

function cleanHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

const importCards: ImportCard[] = [];
let skippedImages = 0;
let skippedUnknownDeck = 0;

for (const card of cards) {
  const note = noteMap.get(card.nid);
  if (!note) continue;

  const fields = note.flds.split("\x1f");
  const front = cleanHtmlEntities(fields[0] ?? "");
  const back = cleanHtmlEntities(fields[1] ?? "");

  // Skip cards with images
  if (front.includes("<img") || back.includes("<img")) {
    skippedImages++;
    continue;
  }

  // Deck → language
  const deckName = deckMap.get(card.did) ?? "Unknown";
  const language = DECK_LANG[deckName];
  if (!language) {
    skippedUnknownDeck++;
    console.warn(`  ⚠ Unknown deck "${deckName}", skipping card`);
    continue;
  }

  // SM-2 conversion
  const ease = card.factor > 0 ? card.factor / 1000 : 2.5;
  const interval = card.ivl > 0 ? card.ivl : 1;
  const repetitions = card.reps;

  // Due date conversion
  let dueDate: string;
  if (card.type === 2) {
    // Review card: due = days since collection epoch
    const due = new Date(COLLECTION_EPOCH);
    due.setDate(due.getDate() + card.due);
    dueDate = due.toISOString().split("T")[0];
  } else {
    // New/learning: due today
    dueDate = new Date().toISOString().split("T")[0];
  }

  importCards.push({
    front,
    back,
    language,
    deckName,
    ease,
    interval,
    repetitions,
    dueDate,
  });
}

// --- Report ---

const byDeck = new Map<string, number>();
for (const c of importCards) {
  byDeck.set(c.deckName, (byDeck.get(c.deckName) ?? 0) + 1);
}

console.log("📊 Import Report:");
console.log(`   Total cards in Anki:  ${cards.length}`);
console.log(`   Cards to import:      ${importCards.length}`);
console.log(`   Skipped (images):     ${skippedImages}`);
console.log(`   Skipped (no deck):    ${skippedUnknownDeck}`);
console.log("");
console.log("   By deck:");
for (const [deck, count] of byDeck) {
  const lang = DECK_LANG[deck] ?? "?";
  console.log(`     ${deck} (${lang}): ${count}`);
}
console.log("");

if (dryRun) {
  console.log("🏁 Dry run complete — no changes made.");
  cleanup();
  process.exit(0);
}

// --- Step 5: Backup + Insert ---

// Backup
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = `${DB_PATH}.backup-${timestamp}`;
fs.copyFileSync(DB_PATH, backupPath);
console.log(`💾 Backup saved to ${path.basename(backupPath)}`);

// Open target DB
const targetDb = new Database(DB_PATH);
targetDb.pragma("journal_mode = WAL");
targetDb.pragma("foreign_keys = ON");

// Ensure name column exists
const hasNameCol = targetDb
  .prepare("PRAGMA table_info(node_sets)")
  .all()
  .some((col: any) => col.name === "name");
if (!hasNameCol) {
  targetDb.exec("ALTER TABLE node_sets ADD COLUMN name TEXT");
}

// Insert in transaction
const insertTransaction = targetDb.transaction(() => {
  // Create node_sets per deck
  const deckToSetId = new Map<string, number>();
  let weekCounter = 0;

  const insertSet = targetDb.prepare(
    "INSERT INTO node_sets (year, week, name) VALUES (0, ?, ?)"
  );
  const findSet = targetDb.prepare(
    "SELECT id FROM node_sets WHERE year = 0 AND week = ?"
  );

  for (const deckName of byDeck.keys()) {
    weekCounter++;
    // Check if slot is taken
    const existing = findSet.get(weekCounter) as { id: number } | undefined;
    if (existing) {
      deckToSetId.set(deckName, existing.id);
    } else {
      const result = insertSet.run(weekCounter, deckName);
      deckToSetId.set(deckName, result.lastInsertRowid as number);
    }
  }

  // Insert learning_nodes + reviews
  const insertNode = targetDb.prepare(
    `INSERT INTO learning_nodes (set_id, node_type, content, language, source_brief_id, source_bullet, created_via)
     VALUES (?, 'flashcard', ?, ?, NULL, NULL, 'import')`
  );

  const insertReview = targetDb.prepare(
    `INSERT INTO reviews (node_id, ease, interval, repetitions, due_date, last_reviewed)
     VALUES (?, ?, ?, ?, ?, NULL)`
  );

  let inserted = 0;
  for (const card of importCards) {
    const setId = deckToSetId.get(card.deckName)!;
    const content = JSON.stringify({ front: card.front, back: card.back });

    const nodeResult = insertNode.run(setId, content, card.language);
    const nodeId = nodeResult.lastInsertRowid as number;

    insertReview.run(nodeId, card.ease, card.interval, card.repetitions, card.dueDate);
    inserted++;
  }

  return inserted;
});

const insertedCount = insertTransaction();

targetDb.close();

console.log(`\n✅ Done! Imported ${insertedCount} cards.`);

// --- Cleanup ---

function cleanup() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

cleanup();
