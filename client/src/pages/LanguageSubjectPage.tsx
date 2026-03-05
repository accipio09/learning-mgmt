import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Loader2,
  BookOpen,
  Plus,
} from "lucide-react";
import { getNodesByLanguage, type LearningNode } from "@/lib/api";
import CreateFlashcardDialog from "@/components/CreateFlashcardDialog";
import NodePreview, {
  typeIcons,
  typeLabels,
  getQuestionText,
} from "@/components/NodePreview";

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

export default function LanguageSubjectPage({
  language,
}: {
  language: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<LearningNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNode, setExpandedNode] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const langName = LANGUAGE_NAMES[language] || language;

  useEffect(() => {
    setLoading(true);
    getNodesByLanguage(language)
      .then(setNodes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [language]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 animate-fade-in-up">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate("/library")}
            className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors font-terminal"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("nav.library")}
          </button>
          <h1 className="text-2xl font-bold font-terminal text-accent">
            {langName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground font-terminal">
            {nodes.length} {t("study.nodes")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors font-terminal"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate(`/study?language=${language}`)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground btn-glow font-terminal"
          >
            <GraduationCap className="h-4 w-4" />
            {t("library.study")}
          </button>
        </div>
      </div>

      {/* Nodes list */}
      {nodes.length === 0 ? (
        <div className="rounded-xl p-12 text-center glow-border">
          <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground font-terminal">
            {t("library.empty")}
          </p>
        </div>
      ) : (
        <div className="rounded-xl glow-border overflow-hidden">
          {nodes.map((node) => {
            const Icon = typeIcons[node.node_type];
            const isExpanded = expandedNode === node.id;
            const preview = getQuestionText(node);

            return (
              <div
                key={node.id}
                className="border-b border-border last:border-b-0"
              >
                <button
                  onClick={() =>
                    setExpandedNode(isExpanded ? null : node.id)
                  }
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/30"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{preview}</p>
                  </div>
                  <span className="text-[10px] font-terminal text-muted-foreground shrink-0">
                    {typeLabels[node.node_type]}
                  </span>
                </button>

                {isExpanded && (
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

      <CreateFlashcardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        language={language}
        onCreated={(node) => setNodes((prev) => [node, ...prev])}
      />
    </div>
  );
}
