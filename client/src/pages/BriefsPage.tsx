import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getLatestBrief,
  createNodeFromBullet,
  type BriefFull,
} from "@/lib/api";
import BriefChat from "@/components/BriefChat";

const mdLink = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline break-all hover:text-glow-cyan hover:opacity-80"
    >
      {children}
    </a>
  ),
};

export default function BriefsPage() {
  const { t } = useTranslation();
  const [brief, setBrief] = useState<BriefFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingBullet, setGeneratingBullet] = useState<string | null>(null);
  const [createdBullets, setCreatedBullets] = useState<Set<string>>(new Set());

  useEffect(() => {
    getLatestBrief()
      .then(setBrief)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-muted-foreground font-terminal">{t("briefs.empty")}</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)]">
      {/* Brief content */}
      <div className="mx-auto max-w-3xl p-6 pb-24 animate-fade-in-up">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold leading-tight font-terminal text-glow">
            {brief.title || brief.filename}
          </h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground font-terminal">
            <span>{brief.date}</span>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium uppercase text-accent border border-accent/20">
              {brief.language}
            </span>
          </div>
        </div>

        {/* Sections with per-bullet node buttons */}
        {brief.structure.map((section, si) => (
          <div key={si} className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-primary font-terminal">
              <span className="text-primary/50 mr-1">&gt;</span>
              {section.heading}
            </h2>
            <div className="space-y-1">
              {section.bullets.map((bullet, bi) => {
                const isCreated = createdBullets.has(bullet);
                const isGenerating = generatingBullet === bullet;

                return (
                  <div
                    key={bi}
                    className="group rounded-lg px-3 py-1.5 transition-all glow-border"
                  >
                    <div className="prose-brief text-secondary-foreground leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={mdLink}
                      >
                        {bullet}
                      </ReactMarkdown>
                    </div>
                    <div className="mt-1 flex justify-end">
                      <button
                        onClick={() => handleMakeNode(bullet, section.heading)}
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
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Chat */}
      <BriefChat briefId={brief.id} />
    </div>
  );
}
