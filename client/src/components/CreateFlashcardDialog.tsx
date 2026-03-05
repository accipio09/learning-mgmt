import { useState } from "react";
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createFlashcardManual,
  createFlashcardFromText,
  type LearningNode,
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language?: string;
  onCreated: (node: LearningNode) => void;
}

export default function CreateFlashcardDialog({
  open,
  onOpenChange,
  language: fixedLanguage,
  onCreated,
}: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [language, setLanguage] = useState(fixedLanguage ?? "de");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    mode === "manual"
      ? front.trim() && back.trim()
      : sourceText.trim();

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const lang = fixedLanguage ?? language;
      const node =
        mode === "manual"
          ? await createFlashcardManual({ front, back, language: lang })
          : await createFlashcardFromText({ text: sourceText, language: lang });
      onCreated(node);
      onOpenChange(false);
      setFront("");
      setBack("");
      setSourceText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create card");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm data-[state=open]:animate-fade-in-up" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-lg data-[state=open]:animate-fade-in-up">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold font-terminal text-foreground">
              {t("card.title")}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* Mode toggle */}
          <div className="mb-4 flex gap-1 rounded-lg bg-secondary/50 p-1 w-fit">
            <button
              onClick={() => setMode("manual")}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-terminal transition-colors",
                mode === "manual"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("card.manual")}
            </button>
            <button
              onClick={() => setMode("ai")}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-terminal transition-colors flex items-center gap-1.5",
                mode === "ai"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t("card.ai")}
            </button>
          </div>

          {/* Language selector (only when no fixed language) */}
          {!fixedLanguage && (
            <div className="mb-4">
              <label className="mb-1 block text-xs font-terminal text-muted-foreground">
                {t("card.language")}
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-terminal text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Manual mode */}
          {mode === "manual" && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-terminal text-muted-foreground">
                  {t("card.front")}
                </label>
                <textarea
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  placeholder={t("card.frontPlaceholder")}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-terminal text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-terminal text-muted-foreground">
                  {t("card.back")}
                </label>
                <textarea
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  placeholder={t("card.backPlaceholder")}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-terminal text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>
          )}

          {/* AI mode */}
          {mode === "ai" && (
            <div>
              <label className="mb-1 block text-xs font-terminal text-muted-foreground">
                {t("card.sourceText")}
              </label>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder={t("card.sourcePlaceholder")}
                rows={5}
                className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-terminal text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          )}

          {error && (
            <p className="mt-2 text-xs font-terminal text-destructive">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-terminal text-foreground hover:bg-secondary/50 transition-colors"
            >
              {t("card.cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium font-terminal text-primary-foreground btn-glow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "ai" ? t("card.generate") : t("card.create")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
