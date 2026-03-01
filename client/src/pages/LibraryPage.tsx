import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Layers,
  ListChecks,
  PenLine,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getNodeSets,
  getNodesInSet,
  getChatSummaries,
  getChatMessages,
  type NodeSet,
  type LearningNode,
  type FlashcardContent,
  type MultipleChoiceContent,
  type FreeResponseContent,
  type ChatSummary,
  type ChatMessage,
} from "@/lib/api";

const typeIcons = {
  flashcard: Layers,
  multiple_choice: ListChecks,
  free_response: PenLine,
};

const typeLabels = {
  flashcard: "Flashcard",
  multiple_choice: "Multiple Choice",
  free_response: "Free Response",
};

function NodePreview({ node }: { node: LearningNode }) {
  const content = node.content;

  if (node.node_type === "flashcard") {
    const fc = content as FlashcardContent;
    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground font-terminal mb-1">
            Q:
          </p>
          <p className="text-sm leading-relaxed">{fc.front}</p>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-success font-terminal mb-1">
            A:
          </p>
          <p className="text-sm leading-relaxed">{fc.back}</p>
        </div>
      </div>
    );
  }

  if (node.node_type === "multiple_choice") {
    const mc = content as MultipleChoiceContent;
    return (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed">{mc.question}</p>
        <div className="space-y-1.5">
          {mc.options.map((opt, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-terminal",
                i === mc.correct_index
                  ? "bg-success/10 text-success border border-success/20"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              {opt}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // free_response
  const fr = content as FreeResponseContent;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground font-terminal mb-1">
          Q:
        </p>
        <p className="text-sm leading-relaxed">{fr.question}</p>
      </div>
      <div className="border-t border-border pt-3">
        <p className="text-xs font-medium text-success font-terminal mb-1">
          Expected:
        </p>
        <p className="text-sm leading-relaxed">{fr.expected_answer}</p>
      </div>
    </div>
  );
}

function getQuestionText(node: LearningNode): string {
  if (node.node_type === "flashcard") {
    return (node.content as FlashcardContent).front;
  }
  if (node.node_type === "multiple_choice") {
    return (node.content as MultipleChoiceContent).question;
  }
  return (node.content as FreeResponseContent).question;
}

const mdLink = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline break-all hover:opacity-80"
    >
      {children}
    </a>
  ),
};

export default function LibraryPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"nodes" | "chats">("nodes");
  const [sets, setSets] = useState<NodeSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSet, setExpandedSet] = useState<number | null>(null);
  const [setNodes, setSetNodes] = useState<Record<number, LearningNode[]>>({});
  const [loadingSet, setLoadingSet] = useState<number | null>(null);
  const [expandedNode, setExpandedNode] = useState<number | null>(null);

  // Chat history state
  const [chatSummaries, setChatSummaries] = useState<ChatSummary[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [expandedChat, setExpandedChat] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<number, ChatMessage[]>>({});
  const [loadingChat, setLoadingChat] = useState<number | null>(null);

  useEffect(() => {
    getNodeSets()
      .then(setSets)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === "chats" && chatSummaries.length === 0) {
      setChatLoading(true);
      getChatSummaries()
        .then(setChatSummaries)
        .catch(console.error)
        .finally(() => setChatLoading(false));
    }
  }, [activeTab]);

  async function toggleSet(setId: number) {
    if (expandedSet === setId) {
      setExpandedSet(null);
      setExpandedNode(null);
      return;
    }

    setExpandedSet(setId);
    setExpandedNode(null);

    // Load nodes if not cached
    if (!setNodes[setId]) {
      setLoadingSet(setId);
      try {
        const nodes = await getNodesInSet(setId);
        setSetNodes((prev) => ({ ...prev, [setId]: nodes }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSet(null);
      }
    }
  }

  async function toggleChat(briefId: number) {
    if (expandedChat === briefId) {
      setExpandedChat(null);
      return;
    }
    setExpandedChat(briefId);
    if (!chatMessages[briefId]) {
      setLoadingChat(briefId);
      try {
        const messages = await getChatMessages(briefId);
        setChatMessages((prev) => ({ ...prev, [briefId]: messages }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingChat(null);
      }
    }
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 animate-fade-in-up">
      <h1 className="mb-4 text-2xl font-bold font-terminal text-glow">
        {t("nav.library")}
      </h1>

      {/* Tab toggle */}
      <div className="mb-6 flex gap-1 rounded-lg bg-secondary/50 p-1 w-fit">
        <button
          onClick={() => setActiveTab("nodes")}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-terminal transition-colors",
            activeTab === "nodes"
              ? "bg-card text-primary shadow-sm text-glow"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("library.nodes")}
        </button>
        <button
          onClick={() => setActiveTab("chats")}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-terminal transition-colors",
            activeTab === "chats"
              ? "bg-card text-primary shadow-sm text-glow"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("library.chats")}
        </button>
      </div>

      {/* Chat History Tab */}
      {activeTab === "chats" && (
        <>
          {chatLoading && (
            <div className="flex items-center gap-2 text-muted-foreground font-terminal">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {t("common.loading")}
            </div>
          )}

          {!chatLoading && chatSummaries.length === 0 && (
            <div className="rounded-xl p-12 text-center glow-border">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground font-terminal">
                {t("library.noChats")}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {chatSummaries.map((summary) => {
              const isExpanded = expandedChat === summary.brief_id;
              const messages = chatMessages[summary.brief_id];
              const isLoading = loadingChat === summary.brief_id;

              return (
                <div key={summary.brief_id} className="rounded-xl glow-border overflow-hidden">
                  <button
                    onClick={() => toggleChat(summary.brief_id)}
                    className="flex w-full items-center justify-between bg-card px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-primary" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <span className="font-medium font-terminal">
                          {summary.brief_title || summary.brief_date}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground font-terminal">
                          {summary.brief_date}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-terminal uppercase text-accent border border-accent/20">
                        {summary.language}
                      </span>
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-terminal text-muted-foreground">
                        {Math.floor(summary.message_count / 2)} {t("library.exchanges")}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border">
                      {isLoading && (
                        <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground font-terminal">
                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          {t("common.loading")}
                        </div>
                      )}

                      {messages && (
                        <div className="divide-y divide-border">
                          {messages
                            .filter((m) => m.role === "user")
                            .map((userMsg, i) => {
                              const assistantMsg = messages.find(
                                (m, j) => j > messages.indexOf(userMsg) && m.role === "assistant"
                              );
                              return (
                                <div key={i}>
                                  <div className="bg-primary/5 px-6 py-3">
                                    <p className="text-xs font-medium text-primary font-terminal mb-1">Q:</p>
                                    <p className="text-sm leading-relaxed">{userMsg.content}</p>
                                  </div>
                                  {assistantMsg && (
                                    <div className="bg-secondary/20 px-6 py-3">
                                      <p className="text-xs font-medium text-success font-terminal mb-1">A:</p>
                                      <div className="prose-chat text-sm leading-relaxed">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdLink}>
                                          {assistantMsg.content}
                                        </ReactMarkdown>
                                      </div>
                                      {assistantMsg.created_at && (
                                        <p className="mt-2 text-[10px] text-muted-foreground font-terminal">
                                          {new Date(assistantMsg.created_at + "Z").toLocaleString()}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Node Sets Tab */}
      {activeTab === "nodes" && sets.length === 0 && (
        <div className="rounded-xl p-12 text-center glow-border">
          <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground font-terminal">
            {t("library.empty")}
          </p>
        </div>
      )}

      {activeTab === "nodes" && <div className="space-y-3">
        {sets.map((set) => {
          const isExpanded = expandedSet === set.id;
          const nodes = setNodes[set.id];
          const isLoading = loadingSet === set.id;

          return (
            <div key={set.id} className="rounded-xl glow-border overflow-hidden">
              {/* Set header */}
              <button
                onClick={() => toggleSet(set.id)}
                className="flex w-full items-center justify-between bg-card px-4 py-3 text-left transition-colors hover:bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium font-terminal text-accent text-glow-cyan">
                    {set.name || `W${set.week}/${set.year}`}
                  </span>
                </div>
                {set.node_count > 0 && (
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-terminal text-muted-foreground">
                    {set.node_count} {t("study.nodes")}
                  </span>
                )}
              </button>

              {/* Expanded nodes list */}
              {isExpanded && (
                <div className="border-t border-border">
                  {isLoading && (
                    <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground font-terminal">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      {t("common.loading")}
                    </div>
                  )}

                  {nodes &&
                    nodes.map((node) => {
                      const Icon = typeIcons[node.node_type];
                      const isNodeExpanded = expandedNode === node.id;
                      const preview = getQuestionText(node);

                      return (
                        <div
                          key={node.id}
                          className="border-b border-border last:border-b-0"
                        >
                          <button
                            onClick={() =>
                              setExpandedNode(
                                isNodeExpanded ? null : node.id
                              )
                            }
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/30"
                          >
                            <Icon className="h-4 w-4 shrink-0 text-primary" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">
                                {preview}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-terminal uppercase text-accent border border-accent/20">
                                {node.language}
                              </span>
                              <span className="text-[10px] font-terminal text-muted-foreground">
                                {typeLabels[node.node_type]}
                              </span>
                            </div>
                          </button>

                          {/* Expanded node content */}
                          {isNodeExpanded && (
                            <div className="bg-secondary/20 px-6 py-4 pl-11">
                              <NodePreview node={node} />
                              {node.source_bullet && (
                                <p className="mt-3 text-xs italic text-muted-foreground font-terminal border-t border-border pt-3">
                                  {node.source_bullet}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>}
    </div>
  );
}
