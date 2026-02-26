import chokidar from "chokidar";
import fs from "fs";
import path from "path";
import db from "../db/client";
import { config, getLanguageForDate } from "../config";
import { parseBriefMarkdown } from "./briefParser";

/**
 * Extract date from brief filename.
 * Supports: 2026-02-25.md, 2026-02-25-wednesday.md, etc.
 */
function parseDateFromFilename(filename: string): string | null {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function indexBrief(filePath: string) {
  const filename = path.basename(filePath);
  const dateStr = parseDateFromFilename(filename);
  if (!dateStr) {
    console.warn(`Skipping ${filename}: cannot parse date from filename`);
    return;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = parseBriefMarkdown(content);
  const language = getLanguageForDate(new Date(dateStr + "T12:00:00"));

  const stmt = db.prepare(`
    INSERT INTO briefs (filename, date, language, title, content, structure)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(filename) DO UPDATE SET
      content = excluded.content,
      structure = excluded.structure,
      title = excluded.title
  `);

  stmt.run(
    filename,
    dateStr,
    language,
    parsed.title,
    content,
    JSON.stringify(parsed.sections)
  );

  console.log(`Indexed brief: ${filename} (${language})`);
}

export function startFileWatcher() {
  const briefsDir = config.briefsDir;

  if (!fs.existsSync(briefsDir)) {
    fs.mkdirSync(briefsDir, { recursive: true });
  }

  // Index existing files on startup
  const existingFiles = fs.readdirSync(briefsDir).filter((f) => f.endsWith(".md"));
  for (const file of existingFiles) {
    indexBrief(path.join(briefsDir, file));
  }
  console.log(`Indexed ${existingFiles.length} existing brief(s)`);

  // Watch for new/changed files
  const watcher = chokidar.watch(path.join(briefsDir, "*.md"), {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500 },
  });

  watcher.on("add", (filePath) => {
    console.log(`New brief detected: ${path.basename(filePath)}`);
    indexBrief(filePath);
  });

  watcher.on("change", (filePath) => {
    console.log(`Brief updated: ${path.basename(filePath)}`);
    indexBrief(filePath);
  });

  console.log(`Watching for briefs in: ${briefsDir}`);
  return watcher;
}
