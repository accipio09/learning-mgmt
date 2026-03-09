import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  GraduationCap,
  MessageSquare,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getBriefs,
  getChatMessages,
  getChatSummaries,
  type BriefSummary,
  type ChatMessage,
  type ChatSummary,
} from "@/lib/api";
import CreateFlashcardDialog from "@/components/CreateFlashcardDialog";
import MonthlyActivityChart from "@/components/MonthlyActivityChart";

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

export default function BriefsSubjectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"briefs" | "chats">("briefs");

  // Briefs state
  const [briefs, setBriefs] = useState<BriefSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Chat history state
  const [chatSummaries, setChatSummaries] = useState<ChatSummary[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [expandedChat, setExpandedChat] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<
    Record<number, ChatMessage[]>
  >({});
  const [loadingChat, setLoadingChat] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    getBriefs()
      .then(setBriefs)
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
          <h1 className="text-2xl font-bold font-terminal text-foreground">
            {t("library.briefs")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors font-terminal"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate("/study?source=briefs")}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground btn-glow font-terminal"
          >
            <GraduationCap className="h-4 w-4" />
            {t("library.study")}
          </button>
        </div>
      </div>

      <MonthlyActivityChart source="briefs" />

      {/* Tab toggle */}
      <div className="mb-6 flex gap-1 rounded-lg bg-secondary/50 p-1 w-fit">
        <button
          onClick={() => setActiveTab("briefs")}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-terminal transition-colors",
            activeTab === "briefs"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("library.history")}
        </button>
        <button
          onClick={() => setActiveTab("chats")}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-terminal transition-colors",
            activeTab === "chats"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("library.chats")}
        </button>
      </div>

      {/* Briefs Tab */}
      {activeTab === "briefs" && (
        <>
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground font-terminal">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {t("common.loading")}
            </div>
          )}

          {!loading && briefs.length === 0 && (
            <div className="rounded-xl p-12 text-center glow-border">
              <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground font-terminal">
                {t("briefs.empty")}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {briefs.map((brief) => (
              <button
                key={brief.id}
                onClick={() => navigate(`/library/briefs/${brief.id}`)}
                className="w-full rounded-xl bg-card p-4 text-left transition-all glow-border"
              >
                <div>
                  <p className="font-medium font-terminal">
                    {brief.title || brief.filename}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground font-terminal">
                    {brief.date}
                    <span className="mx-2">&middot;</span>
                    <span className="capitalize">
                      {new Date(
                        brief.date + "T00:00:00"
                      ).toLocaleDateString(brief.language, {
                        weekday: "long",
                      })}
                    </span>
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

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
                <div
                  key={summary.brief_id}
                  className="rounded-xl glow-border overflow-hidden"
                >
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
                        {Math.floor(summary.message_count / 2)}{" "}
                        {t("library.exchanges")}
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
                                (m, j) =>
                                  j > messages.indexOf(userMsg) &&
                                  m.role === "assistant"
                              );
                              return (
                                <div key={i}>
                                  <div className="bg-primary/5 px-6 py-3">
                                    <p className="text-xs font-medium text-primary font-terminal mb-1">
                                      Q:
                                    </p>
                                    <p className="text-sm leading-relaxed">
                                      {userMsg.content}
                                    </p>
                                  </div>
                                  {assistantMsg && (
                                    <div className="bg-secondary/20 px-6 py-3">
                                      <p className="text-xs font-medium text-success font-terminal mb-1">
                                        A:
                                      </p>
                                      <div className="prose-chat text-sm leading-relaxed">
                                        <ReactMarkdown
                                          remarkPlugins={[remarkGfm]}
                                          components={mdLink}
                                        >
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
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <CreateFlashcardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => {}}
      />
    </div>
  );
}
