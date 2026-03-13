import { Router } from "express";
import db from "../db/client";
import { reindexBriefs } from "../services/fileWatcher";

const router = Router();

function parseBriefStructure(brief: Record<string, unknown>) {
  try {
    return {
      ...brief,
      structure: JSON.parse(brief.structure as string),
    };
  } catch {
    return {
      ...brief,
      structure: [],
    };
  }
}

// List all briefs (summary only)
router.get("/", (_req, res) => {
  const briefs = db
    .prepare(
      "SELECT id, filename, date, language, title, created_at FROM briefs ORDER BY date DESC"
    )
    .all();
  res.json(briefs);
});

// Get the most recent brief (used as "today's" brief on the landing page)
router.get("/latest", (_req, res) => {
  const brief = db
    .prepare("SELECT * FROM briefs ORDER BY date DESC LIMIT 1")
    .get();
  if (!brief) {
    return res.status(404).json({ error: "No briefs found" });
  }
  res.json(parseBriefStructure(brief as Record<string, unknown>));
});

// Get single brief with full content and structure
router.get("/:id", (req, res) => {
  const brief = db
    .prepare("SELECT * FROM briefs WHERE id = ?")
    .get(req.params.id);
  if (!brief) {
    return res.status(404).json({ error: "Brief not found" });
  }
  res.json(parseBriefStructure(brief as Record<string, unknown>));
});

// Re-scan briefs directory and index all .md files
router.post("/reindex", (_req, res) => {
  const indexed = reindexBriefs();
  res.json({ indexed });
});

export default router;
