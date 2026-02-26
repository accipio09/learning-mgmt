import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Layers,
  ListChecks,
  PenLine,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getNodeSets,
  getNodesInSet,
  type NodeSet,
  type LearningNode,
  type FlashcardContent,
  type MultipleChoiceContent,
  type FreeResponseContent,
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

export default function LibraryPage() {
  const { t } = useTranslation();
  const [sets, setSets] = useState<NodeSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSet, setExpandedSet] = useState<number | null>(null);
  const [setNodes, setSetNodes] = useState<Record<number, LearningNode[]>>({});
  const [loadingSet, setLoadingSet] = useState<number | null>(null);
  const [expandedNode, setExpandedNode] = useState<number | null>(null);

  useEffect(() => {
    getNodeSets()
      .then(setSets)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 animate-fade-in-up">
      <h1 className="mb-6 text-2xl font-bold font-terminal text-glow">
        {t("nav.library")}
      </h1>

      {sets.length === 0 && (
        <div className="rounded-xl p-12 text-center glow-border">
          <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground font-terminal">
            {t("library.empty")}
          </p>
        </div>
      )}

      <div className="space-y-3">
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
                    W{set.week}/{set.year}
                  </span>
                </div>
                {nodes && (
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-terminal text-muted-foreground">
                    {nodes.length} {t("study.nodes")}
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
      </div>
    </div>
  );
}
