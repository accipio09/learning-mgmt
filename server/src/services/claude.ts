import Anthropic from "@anthropic-ai/sdk";
import { config, getLanguageName } from "../config";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

// --- Node types ---

export type NodeType = "flashcard" | "multiple_choice" | "free_response";

export interface FlashcardContent {
  front: string;
  back: string;
}

export interface MultipleChoiceContent {
  question: string;
  options: string[];
  correct_index: number;
}

export interface FreeResponseContent {
  question: string;
  expected_answer: string;
}

export type NodeContent =
  | FlashcardContent
  | MultipleChoiceContent
  | FreeResponseContent;

export interface GeneratedNode {
  node_type: NodeType;
  content: NodeContent;
}

const NODE_TYPES: NodeType[] = [
  "flashcard",
  "multiple_choice",
  "free_response",
];

function pickRandomType(): NodeType {
  return NODE_TYPES[Math.floor(Math.random() * NODE_TYPES.length)];
}

// --- Prompt builders per type ---

function buildFlashcardPrompt(
  bullet: string,
  sectionHeading: string
): string {
  return `Section: "${sectionHeading}"
Source bullet: "${bullet}"

Generate an analytical flashcard:
- "front": A second-order question that requires recalling this event AND making a judgment about its implications, significance, or consequences. Do NOT just restate the bullet.
- "back": A concise analytical answer. STRICT LIMIT: maximum 3 sentences, each sentence no more than 10 words. Be direct and dense.

Return ONLY this JSON:
{"front": "...", "back": "..."}`;
}

function buildMultipleChoicePrompt(
  bullet: string,
  sectionHeading: string
): string {
  return `Section: "${sectionHeading}"
Source bullet: "${bullet}"

Generate a multiple-choice question:
- The question should test analytical understanding of this event (implications, causes, consequences)
- Provide exactly 4 plausible options. All should sound reasonable but only one is correct.
- "correct_index" is the 0-based index of the correct answer

Return ONLY this JSON:
{"question": "...", "options": ["A", "B", "C", "D"], "correct_index": 0}`;
}

function buildFreeResponsePrompt(
  bullet: string,
  sectionHeading: string
): string {
  return `Section: "${sectionHeading}"
Source bullet: "${bullet}"

Generate a free-response question:
- The question should require analytical reasoning about this event's significance, implications, or strategic meaning
- The expected answer should be a concise but thorough explanation (2-4 sentences)
- Do NOT restate the bullet as the question

Return ONLY this JSON:
{"question": "...", "expected_answer": "..."}`;
}

// --- Validation ---

function validateNodeContent(
  parsed: unknown,
  nodeType: NodeType
): NodeContent | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  switch (nodeType) {
    case "flashcard": {
      if (
        typeof obj.front !== "string" ||
        typeof obj.back !== "string" ||
        !obj.front.trim() ||
        !obj.back.trim()
      )
        return null;
      // Mirroring bug fix: front and back must differ
      if (obj.front.trim() === obj.back.trim()) return null;
      return { front: obj.front, back: obj.back };
    }
    case "multiple_choice": {
      if (
        typeof obj.question !== "string" ||
        !obj.question.trim() ||
        !Array.isArray(obj.options) ||
        obj.options.length !== 4 ||
        !obj.options.every((o: unknown) => typeof o === "string") ||
        typeof obj.correct_index !== "number" ||
        obj.correct_index < 0 ||
        obj.correct_index > 3
      )
        return null;
      return {
        question: obj.question,
        options: obj.options as string[],
        correct_index: obj.correct_index,
      };
    }
    case "free_response": {
      if (
        typeof obj.question !== "string" ||
        typeof obj.expected_answer !== "string" ||
        !obj.question.trim() ||
        !obj.expected_answer.trim()
      )
        return null;
      return {
        question: obj.question,
        expected_answer: obj.expected_answer,
      };
    }
    default:
      return null;
  }
}

/**
 * Generate a learning node from a single bullet.
 */
export async function generateNodeFromBullet(
  bullet: string,
  sectionHeading: string,
  languageCode: string,
  nodeType?: NodeType
): Promise<GeneratedNode> {
  const type = nodeType || pickRandomType();
  const langName = getLanguageName(languageCode);

  let userPrompt: string;
  switch (type) {
    case "flashcard":
      userPrompt = buildFlashcardPrompt(bullet, sectionHeading);
      break;
    case "multiple_choice":
      userPrompt = buildMultipleChoicePrompt(bullet, sectionHeading);
      break;
    case "free_response":
      userPrompt = buildFreeResponsePrompt(bullet, sectionHeading);
      break;
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are generating a learning exercise from a news brief.
The source content is in ${langName}. Generate all text in ${langName}.
IMPORTANT: Return ONLY a JSON object with no additional text or markdown formatting.`,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);
    const validated = validateNodeContent(parsed, type);
    if (!validated) throw new Error("Validation failed");
    return { node_type: type, content: validated };
  } catch {
    // Fallback: create a free_response node that never mirrors
    return {
      node_type: "free_response",
      content: {
        question: `[${sectionHeading}] What happened and why does it matter?`,
        expected_answer: bullet,
      },
    };
  }
}

/**
 * Generate multiple learning nodes from a batch of bullets.
 */
export async function generateNodesFromBullets(
  bullets: Array<{
    bullet: string;
    sectionHeading: string;
    briefId: number;
    languageCode: string;
  }>
): Promise<
  Array<{
    node_type: NodeType;
    content: NodeContent;
    briefId: number;
    bullet: string;
    language: string;
  }>
> {
  const results = [];
  for (const item of bullets) {
    const node = await generateNodeFromBullet(
      item.bullet,
      item.sectionHeading,
      item.languageCode
    );
    results.push({
      node_type: node.node_type,
      content: node.content,
      briefId: item.briefId,
      bullet: item.bullet,
      language: item.languageCode,
    });
  }
  return results;
}

/**
 * Chat Q&A about a brief with Claude (non-streaming).
 */
export async function chatWithBrief(
  briefContent: string,
  languageCode: string,
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const langName = getLanguageName(languageCode);

  const messages = [
    ...history.map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user" as const, content: message },
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: `You are an analytical assistant helping the user understand a news brief.
The brief is written in ${langName}. Respond in ${langName}. Respond with humor also and in a way that forces the user to think.

Here is the brief content:
---
${briefContent}
---

Answer the user's questions about the events in this brief. Be analytical and insightful.`,
    messages,
  });

  return response.content[0].type === "text"
    ? response.content[0].text
    : "No response generated.";
}
