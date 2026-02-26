import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Send, MessageSquare, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { chatWithBrief, getChatMessages, type ChatMessage } from "@/lib/api";

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

export default function BriefChat({ briefId }: { briefId: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load persisted messages when brief changes
  useEffect(() => {
    setInput("");
    getChatMessages(briefId)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [briefId]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    const userMessage = input.trim();
    setInput("");
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(newMessages);
    setSending(true);
    try {
      const { response } = await chatWithBrief(briefId, userMessage);
      setMessages([
        ...newMessages,
        { role: "assistant", content: response },
      ]);
    } catch (err) {
      console.error(err);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content:
            t("common.error") +
            ": " +
            (err instanceof Error ? err.message : t("chat.thinking")),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 btn-glow",
          open && "pointer-events-none opacity-0"
        )}
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Bottom drawer */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border-t border-border bg-card shadow-2xl transition-transform duration-300 ease-out",
          open
            ? "translate-y-0 max-h-[50vh]"
            : "translate-y-full max-h-[50vh]"
        )}
      >
        {/* Handle bar + header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold font-terminal">
              {t("chat.title")}
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto max-w-3xl space-y-3">
            {messages.length === 0 && (
              <p className="pt-8 text-center text-sm text-muted-foreground font-terminal">
                {t("chat.placeholder")}
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground font-terminal"
                    : "prose-chat bg-secondary text-secondary-foreground"
                )}
              >
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={mdLink}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-terminal">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                {t("chat.thinking")}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border px-4 py-3">
          <div className="mx-auto flex max-w-3xl gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={`$ ${t("chat.placeholder")}`}
              className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary font-terminal"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="rounded-lg bg-primary px-3 py-2 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 btn-glow"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
