import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronLeft,
  Loader2,
  Sparkles,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getBrief,
  createNodeFromBullet,
  getChatMessages,
  type BriefFull,
  type ChatMessage,
} from "@/lib/api";
import BriefChat from "@/components/BriefChat";

function cleanUrl(raw: string): string {
  return raw.replace(/[).,;:]+$/, "");
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

export default function BriefDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [brief, setBrief] = useState<BriefFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingBullet, setGeneratingBullet] = useState<string | null>(null);
  const [createdBullets, setCreatedBullets] = useState<Set<string>>(new Set());
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getBrief(Number(id))
      .then((b) => {
        setBrief(b);
        getChatMessages(b.id)
          .then(setChatLog)
          .catch(() => setChatLog([]));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

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

  if (loading || !brief) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)]">
      <div className="mx-auto max-w-3xl p-6 pb-24 animate-fade-in-up">
        <button
          onClick={() => navigate("/library/briefs")}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors font-terminal"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("library.briefs")}
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold leading-tight font-terminal text-foreground">
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

        {/* Sections */}
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
                  const rawUrl =
                    bullet.match(/https?:\/\/\S+/)?.[0] ?? sectionUrl;
                  const bulletUrl = rawUrl ? cleanUrl(rawUrl) : null;
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

        {/* Chat Log */}
        {chatLog.length > 0 && (
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="mb-4 text-lg font-semibold text-primary font-terminal">
              <span className="text-primary/50 mr-1">&mdash;</span>
              {t("chat.log")}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({Math.floor(chatLog.length / 2)} {t("library.exchanges")})
              </span>
            </h2>
            <div className="space-y-4">
              {chatLog
                .filter((m) => m.role === "user")
                .map((userMsg, i) => {
                  const assistantMsg = chatLog.find(
                    (m, j) =>
                      j > chatLog.indexOf(userMsg) && m.role === "assistant"
                  );
                  return (
                    <div
                      key={i}
                      className="rounded-xl glow-border overflow-hidden"
                    >
                      <div className="bg-primary/10 px-4 py-3">
                        <p className="text-xs font-medium text-primary font-terminal mb-1">
                          Q:
                        </p>
                        <p className="text-sm leading-relaxed">
                          {userMsg.content}
                        </p>
                      </div>
                      {assistantMsg && (
                        <div className="bg-secondary/30 px-4 py-3 border-t border-border">
                          <p className="text-xs font-medium text-success font-terminal mb-1">
                            A:
                          </p>
                          <div className="prose-chat text-sm leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {assistantMsg.content}
                            </ReactMarkdown>
                          </div>
                          {assistantMsg.created_at && (
                            <p className="mt-2 text-[10px] text-muted-foreground font-terminal">
                              {new Date(
                                assistantMsg.created_at + "Z"
                              ).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Chat FAB */}
      <BriefChat briefId={brief.id} />
    </div>
  );
}
