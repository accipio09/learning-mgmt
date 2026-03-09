import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, FileText, Languages } from "lucide-react";
import { getSubjects, type Subject } from "@/lib/api";
import MonthlyActivityChart from "@/components/MonthlyActivityChart";

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

export default function LibraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSubjects()
      .then(setSubjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 animate-fade-in-up">
      <h1 className="mb-6 text-2xl font-bold font-terminal text-foreground">
        {t("nav.library")}
      </h1>

      <MonthlyActivityChart />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((subject) => {
          if (subject.type === "briefs") {
            return (
              <button
                key="briefs"
                onClick={() => navigate("/library/briefs")}
                className="rounded-xl p-6 text-left transition-all glow-border card-float bg-card hover:bg-secondary/30"
              >
                <FileText className="h-8 w-8 text-primary mb-3" />
                <h2 className="text-lg font-semibold font-terminal text-primary">
                  {t("library.briefs")}
                </h2>
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-muted-foreground font-terminal">
                    {subject.brief_count} {t("library.briefCount")}
                  </p>
                  {subject.chat_count > 0 && (
                    <p className="text-sm text-muted-foreground font-terminal">
                      {subject.chat_count} {t("library.chatCount")}
                    </p>
                  )}
                  {subject.node_count > 0 && (
                    <p className="text-sm text-muted-foreground font-terminal">
                      {subject.node_count} {t("study.nodes")}
                    </p>
                  )}
                </div>
                {subject.due_count > 0 && (
                  <div className="mt-3">
                    <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-terminal text-primary border border-primary/20">
                      {subject.due_count} {t("library.due")}
                    </span>
                  </div>
                )}
              </button>
            );
          }

          const langName =
            LANGUAGE_NAMES[subject.language_code] || subject.language_code;

          return (
            <button
              key={subject.slug}
              onClick={() => navigate(`/library/${subject.slug}`)}
              className="rounded-xl p-6 text-left transition-all glow-border card-float bg-card hover:bg-secondary/30"
            >
              <Languages className="h-8 w-8 text-accent mb-3" />
              <h2 className="text-lg font-semibold font-terminal text-accent">
                {langName}
              </h2>
              <div className="mt-3 space-y-1">
                <p className="text-sm text-muted-foreground font-terminal">
                  {subject.node_count} {t("study.nodes")}
                </p>
              </div>
              {subject.due_count > 0 && (
                <div className="mt-3">
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-terminal text-primary border border-primary/20">
                    {subject.due_count} {t("library.due")}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
