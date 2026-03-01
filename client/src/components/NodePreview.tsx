import { Layers, ListChecks, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  LearningNode,
  FlashcardContent,
  MultipleChoiceContent,
  FreeResponseContent,
} from "@/lib/api";

export const typeIcons = {
  flashcard: Layers,
  multiple_choice: ListChecks,
  free_response: PenLine,
};

export const typeLabels = {
  flashcard: "Flashcard",
  multiple_choice: "Multiple Choice",
  free_response: "Free Response",
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export function getQuestionText(node: LearningNode): string {
  if (node.node_type === "flashcard") {
    return stripHtml((node.content as FlashcardContent).front);
  }
  if (node.node_type === "multiple_choice") {
    return stripHtml((node.content as MultipleChoiceContent).question);
  }
  return stripHtml((node.content as FreeResponseContent).question);
}

export default function NodePreview({ node }: { node: LearningNode }) {
  const content = node.content;

  if (node.node_type === "flashcard") {
    const fc = content as FlashcardContent;
    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground font-terminal mb-1">
            Q:
          </p>
          <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: fc.front }} />
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-success font-terminal mb-1">
            A:
          </p>
          <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: fc.back }} />
        </div>
      </div>
    );
  }

  if (node.node_type === "multiple_choice") {
    const mc = content as MultipleChoiceContent;
    return (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: mc.question }} />
        <div className="space-y-1.5">
          {mc.options.map((opt, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-terminal",
                i === mc.correct_index
                  ? "bg-success/10 text-success border border-success/20"
                  : "bg-secondary text-secondary-foreground"
              )}
              dangerouslySetInnerHTML={{ __html: opt }}
            />
          ))}
        </div>
      </div>
    );
  }

  // free_response
  const fr = content as FreeResponseContent;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground font-terminal mb-1">
          Q:
        </p>
        <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: fr.question }} />
      </div>
      <div className="border-t border-border pt-3">
        <p className="text-xs font-medium text-success font-terminal mb-1">
          Expected:
        </p>
        <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: fr.expected_answer }} />
      </div>
    </div>
  );
}
