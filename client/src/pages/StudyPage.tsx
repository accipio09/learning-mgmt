import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, RotateCcw, Sparkles, Trophy, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getDueNodes,
  submitReview,
  generateWeekNodes,
  getNodeSets,
  type LearningNode,
  type NodeSet,
  type FlashcardContent,
  type MultipleChoiceContent,
  type FreeResponseContent,
} from "@/lib/api";

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

// --- Flashcard Node ---
function FlashcardNode({
  content,
  language,
  sourceBullet,
  onReveal,
}: {
  content: FlashcardContent;
  language: string;
  sourceBullet?: string;
  onReveal: () => void;
}) {
  const { t } = useTranslation();
  const [flipped, setFlipped] = useState(false);

  function handleFlip() {
    if (!flipped) {
      setFlipped(true);
      onReveal();
    }
  }

  return (
    <div className="flex flex-col items-center w-full">
      <div
        onClick={handleFlip}
        className={cn(
          "relative w-full max-w-lg cursor-pointer perspective-[1000px] card-float",
          flipped && "flashcard-flipped"
        )}
      >
        <div className="flashcard-inner relative min-h-[300px]">
          {/* Front */}
          <div className="flashcard-front absolute inset-0 rounded-2xl p-8 flex flex-col items-center justify-center text-center glow-border">
            <p className="text-xs font-medium text-accent uppercase tracking-wider mb-4 font-terminal text-glow-cyan">
              {language}
            </p>
            <p className="text-lg leading-relaxed">{content.front}</p>
            {!flipped && (
              <button
                onClick={handleFlip}
                className="mt-6 flex items-center gap-1 text-sm text-primary hover:underline font-terminal text-glow"
              >
                <RotateCcw className="h-3 w-3" />
                {t("study.showAnswer")}
              </button>
            )}
          </div>

          {/* Back */}
          <div className="flashcard-back absolute inset-0 rounded-2xl p-8 flex flex-col items-center justify-center text-center glow-border">
            <p className="text-xs font-medium text-accent uppercase tracking-wider mb-4 font-terminal text-glow-cyan">
              {language}
            </p>
            <p className="text-lg leading-relaxed">{content.back}</p>
            {sourceBullet && (
              <p className="mt-4 text-xs text-muted-foreground italic font-terminal">
                {sourceBullet}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Multiple Choice Node ---
function MultipleChoiceNode({
  content,
  language,
  onReveal,
}: {
  content: MultipleChoiceContent;
  language: string;
  onReveal: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  function handleSelect(index: number) {
    if (selected !== null) return;
    setSelected(index);
    onReveal();
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="rounded-2xl p-8 glow-border">
        <p className="text-xs font-medium text-accent uppercase tracking-wider mb-4 font-terminal text-glow-cyan">
          {language}
        </p>
        <p className="text-lg leading-relaxed mb-6">{content.question}</p>
        <div className="space-y-3">
          {content.options.map((option, i) => {
            const isCorrect = i === content.correct_index;
            const isSelected = selected === i;
            const isRevealed = selected !== null;

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={isRevealed}
                className={cn(
                  "w-full rounded-xl px-4 py-3 text-left text-sm transition-all glow-border font-terminal",
                  !isRevealed && "hover:bg-primary/10 cursor-pointer",
                  isRevealed && isCorrect && "bg-success/15 border-success/40",
                  isRevealed &&
                    isSelected &&
                    !isCorrect &&
                    "bg-destructive/15 border-destructive/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span>{option}</span>
                  {isRevealed && isCorrect && (
                    <Check className="h-4 w-4 text-success shrink-0" />
                  )}
                  {isRevealed && isSelected && !isCorrect && (
                    <X className="h-4 w-4 text-destructive shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Free Response Node ---
function FreeResponseNode({
  content,
  language,
  onReveal,
}: {
  content: FreeResponseContent;
  language: string;
  onReveal: () => void;
}) {
  const { t } = useTranslation();
  const [answer, setAnswer] = useState("");
  const [showExpected, setShowExpected] = useState(false);

  function handleCheck() {
    setShowExpected(true);
    onReveal();
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="rounded-2xl p-8 glow-border">
        <p className="text-xs font-medium text-accent uppercase tracking-wider mb-4 font-terminal text-glow-cyan">
          {language}
        </p>
        <p className="text-lg leading-relaxed mb-6">{content.question}</p>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={t("study.typeAnswer")}
          disabled={showExpected}
          rows={4}
          className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-terminal resize-none outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
        />
        {!showExpected && (
          <button
            onClick={handleCheck}
            disabled={!answer.trim()}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground btn-glow font-terminal disabled:opacity-50"
          >
            {t("study.checkAnswer")}
          </button>
        )}
        {showExpected && (
          <div className="mt-4 rounded-xl bg-success/10 border border-success/20 p-4">
            <p className="text-xs font-medium text-success mb-2 font-terminal">
              {t("study.expectedAnswer")}:
            </p>
            <p className="text-sm leading-relaxed">
              {content.expected_answer}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Study Page ---
export default function StudyPage() {
  const { t } = useTranslation();
  const [dueNodes, setDueNodes] = useState<LearningNode[]>([]);
  const [sets, setSets] = useState<NodeSet[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [nodes, nodeSets] = await Promise.all([
        getDueNodes(),
        getNodeSets(),
      ]);
      setDueNodes(nodes);
      setSets(nodeSets);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRating(rating: number) {
    const node = dueNodes[currentIndex];
    if (!node) return;

    try {
      await submitReview(node.id, rating);
      setReviewed((r) => r + 1);
      setRevealed(false);

      if (currentIndex < dueNodes.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        setDueNodes([]);
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleGenerateWeek() {
    setGenerating(true);
    try {
      const now = new Date();
      await generateWeekNodes({
        year: now.getFullYear(),
        week: getISOWeek(now),
      });
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const currentNode = dueNodes[currentIndex];
  const total = dueNodes.length + reviewed;

  return (
    <div className="mx-auto max-w-4xl p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold font-terminal text-glow">
          {t("study.title")}
        </h1>
        <button
          onClick={handleGenerateWeek}
          disabled={generating}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 font-terminal btn-glow"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("study.generating")}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {t("study.generateWeek")}
            </>
          )}
        </button>
      </div>

      {/* Node Sets overview */}
      {sets.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {sets.map((set) => (
            <div
              key={set.id}
              className="shrink-0 rounded-lg bg-card px-3 py-2 text-xs font-terminal glow-border-cyan"
            >
              <span className="font-medium text-accent">
                {set.name || `W${set.week}/${set.year}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Due count / progress */}
      {total > 0 && currentNode && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground font-terminal">
            <span>
              {t("study.dueToday")}: {dueNodes.length} {t("study.nodes")}
            </span>
            <span>
              {t("study.progress")}: {reviewed}/{total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 progress-glow"
              style={{ width: `${(reviewed / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Study node */}
      {currentNode ? (
        <div className={cn("flex flex-col items-center", revealed && "pb-20")}>
          {currentNode.node_type === "flashcard" && (
            <FlashcardNode
              content={currentNode.content as FlashcardContent}
              language={currentNode.language}
              sourceBullet={currentNode.source_bullet}
              onReveal={() => setRevealed(true)}
            />
          )}
          {currentNode.node_type === "multiple_choice" && (
            <MultipleChoiceNode
              content={currentNode.content as MultipleChoiceContent}
              language={currentNode.language}
              onReveal={() => setRevealed(true)}
            />
          )}
          {currentNode.node_type === "free_response" && (
            <FreeResponseNode
              content={currentNode.content as FreeResponseContent}
              language={currentNode.language}
              onReveal={() => setRevealed(true)}
            />
          )}

          {/* Rating buttons — fixed at bottom when revealed */}
          {revealed && (
            <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center gap-3 bg-background/80 backdrop-blur-sm border-t border-border px-4 py-4">
              {[
                {
                  rating: 1,
                  label: t("study.again"),
                  color: "bg-destructive",
                },
                { rating: 2, label: t("study.hard"), color: "bg-warning" },
                { rating: 3, label: t("study.good"), color: "bg-success" },
                { rating: 4, label: t("study.easy"), color: "bg-primary" },
              ].map(({ rating, label, color }) => (
                <button
                  key={rating}
                  onClick={() => handleRating(rating)}
                  className={cn(
                    "rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 font-terminal btn-glow",
                    color
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl p-16 text-center glow-border">
          <Trophy className="mx-auto mb-4 h-16 w-16 text-success text-glow" />
          <p className="text-lg font-medium font-terminal">
            {t("study.noDue")}
          </p>
          {reviewed > 0 && (
            <p className="mt-2 text-sm text-muted-foreground font-terminal">
              {reviewed} {t("study.nodes")} reviewed
            </p>
          )}
        </div>
      )}
    </div>
  );
}
