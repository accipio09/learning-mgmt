import { Router } from "express";
import db from "../db/client";
import { chatWithBrief } from "../services/claude";

const router = Router();

const MAX_HISTORY_LENGTH = 50;

let insertMessage: ReturnType<typeof db.prepare<[number, string, string]>> | null = null;
function getInsertMessage() {
  if (!insertMessage) {
    insertMessage = db.prepare<[number, string, string]>(
      "INSERT INTO chat_messages (brief_id, role, content) VALUES (?, ?, ?)"
    );
  }
  return insertMessage;
}

// Chat summaries: briefs that have chat messages
router.get("/summaries", (_req, res) => {
  const summaries = db
    .prepare(
      `SELECT cm.brief_id, b.title AS brief_title, b.date AS brief_date, b.language,
              COUNT(*) AS message_count
       FROM chat_messages cm
       JOIN briefs b ON b.id = cm.brief_id
       GROUP BY cm.brief_id
       ORDER BY MAX(cm.id) DESC`
    )
    .all();

  res.json(summaries);
});

// Load persisted messages for a brief
router.get("/:briefId", (req, res) => {
  const briefId = Number(req.params.briefId);
  if (!briefId || isNaN(briefId)) {
    return res.status(400).json({ error: "Invalid briefId" });
  }

  const messages = db
    .prepare(
      "SELECT role, content, created_at FROM chat_messages WHERE brief_id = ? ORDER BY id ASC"
    )
    .all(briefId) as Array<{ role: string; content: string; created_at: string }>;

  res.json(messages);
});

router.post("/", async (req, res) => {
  try {
    const { briefId, message } = req.body;

    if (!briefId || typeof briefId !== "number") {
      return res.status(400).json({ error: "briefId (number) is required" });
    }
    if (!message || typeof message !== "string" || message.length > 5000) {
      return res
        .status(400)
        .json({ error: "message (string, max 5000 chars) is required" });
    }

    const brief = db
      .prepare("SELECT * FROM briefs WHERE id = ?")
      .get(briefId) as { content: string; language: string } | undefined;

    if (!brief) {
      return res.status(404).json({ error: "Brief not found" });
    }

    // Load history from database
    const history = db
      .prepare(
        "SELECT role, content FROM chat_messages WHERE brief_id = ? ORDER BY id ASC"
      )
      .all(briefId) as Array<{ role: "user" | "assistant"; content: string }>;

    // Cap history to prevent cost abuse
    const safeHistory = history.slice(-MAX_HISTORY_LENGTH);

    const response = await chatWithBrief(
      brief.content,
      brief.language,
      message,
      safeHistory
    );

    // Persist both messages
    const stmt = getInsertMessage();
    const saveMessages = db.transaction(() => {
      stmt.run(briefId, "user", message);
      stmt.run(briefId, "assistant", response);
    });
    saveMessages();

    res.json({ response });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Failed to get response" });
  }
});

export default router;
