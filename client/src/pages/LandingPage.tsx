import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RotateCcw, Loader2, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ParticleSystem } from "@/lib/particles";
import { getTodayLanguage } from "@/i18n/index";
import BriefChat from "@/components/BriefChat";
import {
  getDueNodes,
  getLatestBrief,
  createNodeFromBullet,
  submitReview,
  type LearningNode,
  type FlashcardContent,
  type MultipleChoiceContent,
  type FreeResponseContent,
  type BriefFull,
} from "@/lib/api";

const LANGUAGE_NAMES: Record<string, string> = {
  de: "Deutsch",
  ru: "Русский",
  ja: "日本語",
  uk: "Українська",
  es: "Español",
  fr: "Français",
  vi: "Tiếng Việt",
  en: "English",
};

type Phase =
  | "dust"
  | "resolving_card"
  | "card"
  | "rating"
  | "dissolving"
  | "dust2"
  | "brief";

function getCardRect(containerW: number, containerH: number) {
  const w = Math.min(480, containerW - 48);
  const h = Math.min(360, containerH - 120);
  return {
    x: (containerW - w) / 2,
    y: (containerH - h) / 2,
    w,
    h,
  };
}

function makeMdComponents(url: string | null) {
  return {
    a: () => null,
    strong: ({ children }: { children?: React.ReactNode }) =>
      url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-foreground hover:text-primary transition-colors"
        >
          {children}
        </a>
      ) : (
        <strong>{children}</strong>
      ),
  };
}

export default function LandingPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const psRef = useRef<ParticleSystem | null>(null);

  const [phase, setPhase] = useState<Phase>("dust");
  const [node, setNode] = useState<LearningNode | null>(null);
  const [brief, setBrief] = useState<BriefFull | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [mcSelected, setMcSelected] = useState<number | null>(null);
  const [frRevealed, setFrRevealed] = useState(false);
  const [generatingBullet, setGeneratingBullet] = useState<string | null>(null);
  const [createdBullets, setCreatedBullets] = useState<Set<string>>(new Set());

  const todayLang = getTodayLanguage();
  const langName = LANGUAGE_NAMES[todayLang] || todayLang;
  const revealed = flipped || mcSelected !== null || frRevealed;

  // Fetch data on mount
  useEffect(() => {
    getDueNodes({ language: todayLang })
      .then((nodes) => {
        if (nodes.length > 0) {
          const idx = Math.floor(Math.random() * nodes.length);
          setNode(nodes[idx]);
        } else {
          // Fallback: try all cards for this language (not just due)
          return getDueNodes({ language: todayLang, all: true }).then((all) => {
            if (all.length > 0) {
              setNode(all[Math.floor(Math.random() * all.length)]);
            }
          });
        }
      })
      .catch(console.error);

    getLatestBrief().then(setBrief).catch(console.error);
  }, [todayLang]);

  // Initialize particle system
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ps = new ParticleSystem(canvas);
    psRef.current = ps;

    const { width, height } = container.getBoundingClientRect();
    ps.resize(width, height);
    ps.start();

    const ro = new ResizeObserver((entries) => {
      const { width: w, height: h } = entries[0].contentRect;
      ps.resize(w, h);
    });
    ro.observe(container);

    return () => {
      ps.stop();
      ro.disconnect();
    };
  }, []);

  // Mouse tracking
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleMove(e: MouseEvent) {
      const rect = container!.getBoundingClientRect();
      psRef.current?.setMouse(e.clientX - rect.left, e.clientY - rect.top);
    }
    container.addEventListener("mousemove", handleMove);
    return () => container.removeEventListener("mousemove", handleMove);
  }, []);

  // Canvas opacity based on phase — keep particles visible around the card
  useEffect(() => {
    const ps = psRef.current;
    if (!ps) return;
    if (phase === "card" || phase === "rating") {
      ps.canvasOpacity = 0.7;
    } else {
      ps.canvasOpacity = 1;
    }
  }, [phase]);

  const handleCanvasClick = useCallback(() => {
    const ps = psRef.current;
    const container = containerRef.current;
    if (!ps || !container) return;

    const { width, height } = container.getBoundingClientRect();

    if (phase === "dust" && node) {
      const rect = getCardRect(width, height);
      ps.onConverged(() => setPhase("card"));
      ps.resolve(rect);
      setPhase("resolving_card");
    } else if (phase === "dust2" && brief) {
      ps.stop();
      setPhase("brief");
    }
  }, [phase, node, brief]);

  async function handleRating(rating: number) {
    if (!node) return;
    try {
      await submitReview(node.id, rating);
    } catch (err) {
      console.error(err);
    }

    setPhase("dissolving");
    psRef.current?.dissolve();
    setFlipped(false);
    setMcSelected(null);
    setFrRevealed(false);

    setTimeout(() => setPhase("dust2"), 800);
  }

  function handleReveal() {
    if (node?.node_type === "flashcard") setFlipped(true);
  }

  function handleMcSelect(i: number) {
    if (mcSelected !== null) return;
    setMcSelected(i);
  }

  function handleFrCheck() {
    setFrRevealed(true);
  }

  async function handleMakeNode(bullet: string, sectionHeading: string) {
    if (!brief) return;
    setGeneratingBullet(bullet);
    try {
      await createNodeFromBullet({
        briefId: brief.id,
        bullet,
        sectionHeading,
        language: brief.language,
      });
      setCreatedBullets((prev) => new Set(prev).add(bullet));
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingBullet(null);
    }
  }

  const showOverlay = phase === "card" || phase === "rating";

  const cardContent = node?.content;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative min-h-[calc(100vh-3.5rem)]",
        phase === "brief" ? "overflow-y-auto" : "overflow-hidden cursor-pointer"
      )}
      onClick={phase !== "brief" ? handleCanvasClick : undefined}
    >
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute inset-0 transition-opacity duration-700",
          phase === "brief" ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      />

      {/* Flashcard overlay */}
      {(phase === "card" || phase === "rating") && node && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-all duration-400 pointer-events-auto",
            phase === "card" || phase === "rating"
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-lg px-6">
            {node.node_type === "flashcard" && cardContent && (
              <div
                onClick={handleReveal}
                className={cn(
                  "rounded-2xl p-8 glow-border bg-white cursor-pointer",
                  flipped && "flashcard-flipped"
                )}
              >
                <div className="flashcard-front">
                  <p className="text-xs font-medium text-accent uppercase tracking-wider mb-4 font-terminal">
                    {langName}
                  </p>
                  <p
                    className="text-lg leading-relaxed text-center"
                    dangerouslySetInnerHTML={{
                      __html: (cardContent as FlashcardContent).front,
                    }}
                  />
                  {!flipped && (
                    <button className="mt-6 mx-auto flex items-center gap-1 text-sm text-primary hover:underline font-terminal">
                      <RotateCcw className="h-3 w-3" />
                      {t("study.showAnswer")}
                    </button>
                  )}
                </div>
                <div className="flashcard-back flex-col items-center text-center">
                  <p className="text-xs font-medium text-accent uppercase tracking-wider mb-4 font-terminal">
                    {langName}
                  </p>
                  <p
                    className="text-lg leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: (cardContent as FlashcardContent).back,
                    }}
                  />
                </div>
              </div>
            )}

            {node.node_type === "multiple_choice" && cardContent && (
              <div className="rounded-2xl p-8 glow-border bg-white">
                <p className="text-xs font-medium text-accent uppercase tracking-wider mb-4 font-terminal">
                  {langName}
                </p>
                <p
                  className="text-lg leading-relaxed mb-6"
                  dangerouslySetInnerHTML={{
                    __html: (cardContent as MultipleChoiceContent).question,
                  }}
                />
                <div className="space-y-3">
                  {(cardContent as MultipleChoiceContent).options.map(
                    (opt, i) => {
                      const mc = cardContent as MultipleChoiceContent;
                      const isCorrect = i === mc.correct_index;
                      const isSelected = mcSelected === i;
                      const isRevealed = mcSelected !== null;
                      return (
                        <button
                          key={i}
                          onClick={() => handleMcSelect(i)}
                          disabled={isRevealed}
                          className={cn(
                            "w-full rounded-xl px-4 py-3 text-left text-sm transition-all glow-border font-terminal",
                            !isRevealed && "hover:bg-primary/10 cursor-pointer",
                            isRevealed &&
                              isCorrect &&
                              "bg-success/15 border-success/40",
                            isRevealed &&
                              isSelected &&
                              !isCorrect &&
                              "bg-destructive/15 border-destructive/40"
                          )}
                        >
                          <span dangerouslySetInnerHTML={{ __html: opt }} />
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {node.node_type === "free_response" && cardContent && (
              <FreeResponseCard
                content={cardContent as FreeResponseContent}
                langName={langName}
                revealed={frRevealed}
                onCheck={handleFrCheck}
              />
            )}

            {/* Rating buttons */}
            {revealed && (
              <div className="mt-6 flex justify-center gap-3">
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
        </div>
      )}

      {/* Full brief + chat */}
      {phase === "brief" && brief && (
        <div className="relative min-h-[calc(100vh-3.5rem)]">
          <div className="mx-auto max-w-3xl p-6 pb-24 animate-fade-in-up">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold leading-tight font-terminal text-glow">
                {brief.title || brief.filename}
              </h1>
              <div className="mt-2 text-sm text-muted-foreground font-terminal">
                <span>{brief.date}</span>
                <span className="mx-2">&middot;</span>
                <span className="capitalize">
                  {new Date(brief.date + "T00:00:00").toLocaleDateString(
                    brief.language,
                    { weekday: "long" }
                  )}
                </span>
              </div>
            </div>

            {/* Sections with per-bullet node buttons */}
            {brief.structure.map((section, si) => (
              <div key={si} className="mb-8">
                <h2 className="mb-4 text-lg font-semibold text-primary font-terminal">
                  <span className="text-primary/50 mr-1">&mdash;</span>
                  {section.heading}
                </h2>
                <div className="space-y-1">
                  {(() => {
                    const sectionUrl =
                      section.bullets
                        .map((b) => b.match(/https?:\/\/\S+/))
                        .find(Boolean)?.[0] ?? null;
                    return section.bullets.map((bullet, bi) => {
                      const isCreated = createdBullets.has(bullet);
                      const isGenerating = generatingBullet === bullet;
                      const bulletUrl =
                        bullet.match(/https?:\/\/\S+/)?.[0] ?? sectionUrl;
                      const clean = bullet.replace(
                        /\s*🔗?\s*https?:\/\/\S+/g,
                        ""
                      );

                      return (
                        <div
                          key={bi}
                          className="group rounded-lg px-3 py-1.5 transition-all"
                        >
                          <div className="prose-brief text-secondary-foreground leading-relaxed">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={makeMdComponents(bulletUrl)}
                            >
                              {clean}
                            </ReactMarkdown>
                          </div>
                          <div className="mt-1 flex justify-end">
                            <button
                              onClick={() =>
                                handleMakeNode(bullet, section.heading)
                              }
                              disabled={isGenerating || isCreated}
                              className={cn(
                                "rounded-md px-2.5 py-1 text-xs font-medium transition-all font-terminal",
                                isCreated
                                  ? "bg-success/10 text-success"
                                  : isGenerating
                                    ? "bg-warning/10 text-warning"
                                    : "bg-primary/10 text-primary opacity-0 group-hover:opacity-100 hover:bg-primary/20 btn-glow"
                              )}
                            >
                              {isCreated ? (
                                <span className="flex items-center gap-1">
                                  <Check className="h-3 w-3" />
                                  {t("briefs.nodeCreated")}
                                </span>
                              ) : isGenerating ? (
                                <span className="flex items-center gap-1">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  {t("briefs.generating")}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Sparkles className="h-3 w-3" />
                                  {t("briefs.makeNode")}
                                </span>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ))}
          </div>

          {/* Chat */}
          <BriefChat briefId={brief.id} />
        </div>
      )}
    </div>
  );
}

// Extracted to avoid hooks-in-callbacks issue
function FreeResponseCard({
  content,
  langName,
  revealed,
  onCheck,
}: {
  content: FreeResponseContent;
  langName: string;
  revealed: boolean;
  onCheck: () => void;
}) {
  const { t } = useTranslation();
  const [answer, setAnswer] = useState("");

  return (
    <div className="rounded-2xl p-8 glow-border bg-white">
      <p className="text-xs font-medium text-accent uppercase tracking-wider mb-4 font-terminal">
        {langName}
      </p>
      <p
        className="text-lg leading-relaxed mb-6"
        dangerouslySetInnerHTML={{ __html: content.question }}
      />
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={t("study.typeAnswer")}
        disabled={revealed}
        rows={3}
        className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-terminal resize-none outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
      />
      {!revealed && (
        <button
          onClick={onCheck}
          disabled={!answer.trim()}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground btn-glow font-terminal disabled:opacity-50"
        >
          {t("study.checkAnswer")}
        </button>
      )}
      {revealed && (
        <div className="mt-4 rounded-xl bg-success/10 border border-success/20 p-4">
          <p className="text-xs font-medium text-success mb-2 font-terminal">
            {t("study.expectedAnswer")}:
          </p>
          <p
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: content.expected_answer }}
          />
        </div>
      )}
    </div>
  );
}
