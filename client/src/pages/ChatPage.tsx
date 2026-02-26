import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getBriefs,
  getBrief,
  chatWithBrief,
  type BriefSummary,
  type BriefFull,
  type ChatMessage,
} from "@/lib/api";

export default function ChatPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [briefs, setBriefs] = useState<BriefSummary[]>([]);
  const [selectedBrief, setSelectedBrief] = useState<BriefFull | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getBriefs().then(setBriefs).catch(console.error);
  }, []);

  // Auto-select brief from URL param
  useEffect(() => {
    const briefId = searchParams.get("briefId");
    if (briefId) {
      selectBrief(parseInt(briefId, 10));
    }
  }, [searchParams]);

  async function selectBrief(id: number) {
    const brief = await getBrief(id);
    setSelectedBrief(brief);
    setMessages([]);
  }

  async function handleSend() {
    if (!input.trim() || !selectedBrief || sending) return;

    const userMessage = input.trim();
    setInput("");
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(newMessages);
    setSending(true);

    try {
      const { response } = await chatWithBrief(
        selectedBrief.id,
        userMessage,
        messages
      );
      setMessages([...newMessages, { role: "assistant", content: response }]);
    } catch (err) {
      console.error(err);
      setMessages([
        ...newMessages,
        { role: "assistant", content: `Error: ${err}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-6xl">
      {/* Brief selector sidebar */}
      <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t("nav.briefs")}
        </h3>
        <div className="space-y-1">
          {briefs.map((brief) => (
            <button
              key={brief.id}
              onClick={() => selectBrief(brief.id)}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                selectedBrief?.id === brief.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <p className="truncate font-medium">
                {brief.title || brief.filename}
              </p>
              <p className="text-xs opacity-60">{brief.date}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {!selectedBrief ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">{t("chat.selectBrief")}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-border px-6 py-3">
              <h2 className="font-semibold">
                {selectedBrief.title || selectedBrief.filename}
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedBrief.date} · {selectedBrief.language.toUpperCase()}
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground pt-12">
                  {t("chat.placeholder")}
                </p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {msg.content}
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("chat.thinking")}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={t("chat.placeholder")}
                  className="flex-1 rounded-lg border border-border bg-secondary px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
