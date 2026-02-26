import { Router } from "express";
import db from "../db/client";
import { calculateSM2 } from "../services/sm2";
import {
  generateNodeFromBullet,
  generateNodesFromBullets,
} from "../services/claude";

const router = Router();

// Get all node sets
router.get("/sets", (_req, res) => {
  const sets = db
    .prepare("SELECT * FROM node_sets ORDER BY year DESC, week DESC")
    .all();
  res.json(sets);
});

// Get all nodes in a set
router.get("/sets/:id", (req, res) => {
  const nodes = db
    .prepare("SELECT * FROM learning_nodes WHERE set_id = ?")
    .all(req.params.id);
  res.json(nodes);
});

// Get today's due nodes
router.get("/due", (_req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const nodes = db
    .prepare(
      `SELECT n.*, r.ease, r.interval, r.repetitions, r.due_date
       FROM learning_nodes n
       JOIN reviews r ON r.node_id = n.id
       WHERE r.due_date <= ?
       ORDER BY r.due_date ASC`
    )
    .all(today);
  res.json(nodes);
});

// Create node from a single bullet (manual)
router.post("/from-bullet", async (req, res) => {
  try {
    const { briefId, bullet, sectionHeading, language } = req.body;

    if (
      typeof briefId !== "number" ||
      typeof bullet !== "string" ||
      !bullet.trim() ||
      typeof sectionHeading !== "string" ||
      typeof language !== "string" ||
      !language.trim()
    ) {
      return res.status(400).json({
        error:
          "briefId (number), bullet, sectionHeading, and language (strings) are required",
      });
    }

    const node = await generateNodeFromBullet(
      bullet,
      sectionHeading,
      language
    );

    // Get or create this week's set
    const now = new Date();
    const week = getISOWeek(now);
    const year = now.getFullYear();
    const set = getOrCreateSet(year, week);

    // Insert learning node
    const insertNode = db.prepare(
      `INSERT INTO learning_nodes (set_id, node_type, content, language, source_brief_id, source_bullet, created_via)
       VALUES (?, ?, ?, ?, ?, ?, 'manual')`
    );
    const result = insertNode.run(
      set.id,
      node.node_type,
      JSON.stringify(node.content),
      language,
      briefId,
      bullet
    );

    // Create initial review state
    const today = new Date().toISOString().split("T")[0];
    db.prepare(
      `INSERT INTO reviews (node_id, due_date) VALUES (?, ?)`
    ).run(result.lastInsertRowid, today);

    res.json({
      id: result.lastInsertRowid,
      node_type: node.node_type,
      content: node.content,
      language,
      source_bullet: bullet,
      created_via: "manual",
    });
  } catch (err) {
    console.error("Error generating node:", err);
    res.status(500).json({ error: "Failed to generate node" });
  }
});

// Auto-generate week's nodes (stratified random sampling)
router.post("/generate-week", async (req, res) => {
  try {
    const { year, week, bulletsPerBrief = 3 } = req.body;

    if (
      typeof year !== "number" ||
      typeof week !== "number" ||
      week < 1 ||
      week > 53
    ) {
      return res
        .status(400)
        .json({ error: "year and week (1-53) are required" });
    }
    const cappedBullets = Math.min(
      Math.max(Number(bulletsPerBrief) || 3, 1),
      10
    );

    // Get briefs for this week
    const weekStart = getDateOfISOWeek(week, year);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const briefs = db
      .prepare(
        `SELECT * FROM briefs
         WHERE date >= ? AND date <= ?
         ORDER BY date`
      )
      .all(
        weekStart.toISOString().split("T")[0],
        weekEnd.toISOString().split("T")[0]
      ) as Array<{
      id: number;
      language: string;
      structure: string;
    }>;

    if (briefs.length === 0) {
      return res
        .status(404)
        .json({ error: "No briefs found for this week" });
    }

    // Stratified random sampling: pick N bullets per brief
    const sampledBullets: Array<{
      bullet: string;
      sectionHeading: string;
      briefId: number;
      languageCode: string;
    }> = [];

    for (const brief of briefs) {
      const sections = JSON.parse(brief.structure) as Array<{
        heading: string;
        bullets: string[];
      }>;
      const allBullets = sections.flatMap((s) =>
        s.bullets.map((b) => ({ bullet: b, sectionHeading: s.heading }))
      );

      const shuffled = allBullets.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, cappedBullets);

      for (const item of selected) {
        sampledBullets.push({
          ...item,
          briefId: brief.id,
          languageCode: brief.language,
        });
      }
    }

    // Generate nodes via Claude
    const generatedNodes = await generateNodesFromBullets(sampledBullets);

    // Save to DB
    const set = getOrCreateSet(year, week);
    const today = new Date().toISOString().split("T")[0];

    const insertNode = db.prepare(
      `INSERT INTO learning_nodes (set_id, node_type, content, language, source_brief_id, source_bullet, created_via)
       VALUES (?, ?, ?, ?, ?, ?, 'auto')`
    );
    const insertReview = db.prepare(
      `INSERT INTO reviews (node_id, due_date) VALUES (?, ?)`
    );

    const savedNodes: Array<Record<string, unknown>> = [];
    const insertTransaction = db.transaction(() => {
      for (const node of generatedNodes) {
        const result = insertNode.run(
          set.id,
          node.node_type,
          JSON.stringify(node.content),
          node.language,
          node.briefId,
          node.bullet
        );
        insertReview.run(result.lastInsertRowid, today);
        savedNodes.push({
          id: result.lastInsertRowid,
          ...node,
        });
      }
    });
    insertTransaction();

    res.json({ setId: set.id, nodes: savedNodes });
  } catch (err) {
    console.error("Error generating week's nodes:", err);
    res.status(500).json({ error: "Failed to generate nodes" });
  }
});

// Submit SM-2 review rating
router.post("/review", (req, res) => {
  const { nodeId, rating } = req.body;

  if (!nodeId || !rating || rating < 1 || rating > 4) {
    return res
      .status(400)
      .json({ error: "nodeId and rating (1-4) required" });
  }

  const review = db
    .prepare("SELECT * FROM reviews WHERE node_id = ?")
    .get(nodeId) as
    | {
        ease: number;
        interval: number;
        repetitions: number;
      }
    | undefined;

  if (!review) {
    return res.status(404).json({ error: "Review record not found" });
  }

  const updated = calculateSM2(
    {
      ease: review.ease,
      interval: review.interval,
      repetitions: review.repetitions,
    },
    rating
  );

  db.prepare(
    `UPDATE reviews
     SET ease = ?, interval = ?, repetitions = ?, due_date = ?, last_reviewed = ?
     WHERE node_id = ?`
  ).run(
    updated.ease,
    updated.interval,
    updated.repetitions,
    updated.dueDate,
    new Date().toISOString(),
    nodeId
  );

  res.json({ nodeId, ...updated });
});

// --- Helpers ---

function getOrCreateSet(year: number, week: number) {
  const existing = db
    .prepare("SELECT * FROM node_sets WHERE year = ? AND week = ?")
    .get(year, week) as { id: number } | undefined;

  if (existing) return existing;

  const result = db
    .prepare("INSERT INTO node_sets (year, week) VALUES (?, ?)")
    .run(year, week);
  return { id: result.lastInsertRowid as number };
}

function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

function getDateOfISOWeek(week: number, year: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  return monday;
}

export default router;
