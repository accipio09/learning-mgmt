const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// --- Briefs ---

export interface BriefSummary {
  id: number;
  filename: string;
  date: string;
  language: string;
  title: string;
  created_at: string;
}

export interface BriefSection {
  heading: string;
  bullets: string[];
}

export interface BriefFull extends BriefSummary {
  content: string;
  structure: BriefSection[];
}

export function getBriefs(): Promise<BriefSummary[]> {
  return request("/briefs");
}

export function getBrief(id: number): Promise<BriefFull> {
  return request(`/briefs/${id}`);
}

export function getLatestBrief(): Promise<BriefFull> {
  return request("/briefs/latest");
}

// --- Chat ---

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

export interface ChatSummary {
  brief_id: number;
  brief_title: string;
  brief_date: string;
  language: string;
  message_count: number;
}

export function getChatSummaries(): Promise<ChatSummary[]> {
  return request("/chat/summaries");
}

export function getChatMessages(briefId: number): Promise<ChatMessage[]> {
  return request(`/chat/${briefId}`);
}

export function chatWithBrief(
  briefId: number,
  message: string
): Promise<{ response: string }> {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify({ briefId, message }),
  });
}

// --- Learning Nodes ---

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

export interface LearningNode {
  id: number;
  set_id: number;
  node_type: NodeType;
  content: NodeContent;
  language: string;
  source_brief_id: number;
  source_bullet: string;
  created_via: string;
  // SM-2 fields (present on due nodes)
  ease?: number;
  interval?: number;
  repetitions?: number;
  due_date?: string;
}

export interface NodeSet {
  id: number;
  year: number;
  week: number;
  generated_at: string;
  name?: string;
}

function parseNode(raw: Record<string, unknown>): LearningNode {
  return {
    ...raw,
    content:
      typeof raw.content === "string"
        ? JSON.parse(raw.content as string)
        : raw.content,
  } as LearningNode;
}

export async function getNodeSets(): Promise<NodeSet[]> {
  return request("/nodes/sets");
}

export async function getNodesInSet(setId: number): Promise<LearningNode[]> {
  const raw = await request<Record<string, unknown>[]>(`/nodes/sets/${setId}`);
  return raw.map(parseNode);
}

export async function getDueNodes(): Promise<LearningNode[]> {
  const raw = await request<Record<string, unknown>[]>("/nodes/due");
  return raw.map(parseNode);
}

export async function createNodeFromBullet(data: {
  briefId: number;
  bullet: string;
  sectionHeading: string;
  language: string;
}): Promise<LearningNode> {
  return request("/nodes/from-bullet", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function generateWeekNodes(data: {
  year: number;
  week: number;
  bulletsPerBrief?: number;
}): Promise<{ setId: number; nodes: LearningNode[] }> {
  return request("/nodes/generate-week", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function submitReview(
  nodeId: number,
  rating: number
): Promise<{
  nodeId: number;
  ease: number;
  interval: number;
  dueDate: string;
}> {
  return request("/nodes/review", {
    method: "POST",
    body: JSON.stringify({ nodeId, rating }),
  });
}
