import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { initializeDatabase } from "./db/schema";
import { startFileWatcher } from "./services/fileWatcher";
import briefsRouter from "./routes/briefs";
import nodesRouter from "./routes/nodes";
import chatRouter from "./routes/chat";

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: [`http://localhost:5173`, `http://localhost:${config.port}`],
  })
);
app.use(express.json({ limit: "50kb" }));

// Rate limiting for AI-powered endpoints (cost protection)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: { error: "Too many requests, please try again later" },
});
app.use("/api/chat", aiLimiter);
app.use("/api/nodes/from-bullet", aiLimiter);
app.use("/api/nodes/generate-week", aiLimiter);

// API routes
app.use("/api/briefs", briefsRouter);
app.use("/api/nodes", nodesRouter);
app.use("/api/chat", chatRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Initialize
initializeDatabase();
startFileWatcher();

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
