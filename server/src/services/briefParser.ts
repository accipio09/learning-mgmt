export interface BriefSection {
  heading: string;
  bullets: string[];
}

export interface ParsedBrief {
  title: string;
  sections: BriefSection[];
}

/**
 * Parses a markdown brief into structured sections with content blocks.
 *
 * Handles multiple content formats under ## sections:
 * - `- ` bullet points
 * - `**N. Title**\nParagraph` numbered entries
 * - Plain paragraphs
 *
 * Each distinct content block becomes one "bullet" in the structure.
 */
export function parseBriefMarkdown(content: string): ParsedBrief {
  const lines = content.split("\n");
  let title = "";
  const sections: BriefSection[] = [];
  let currentSection: BriefSection | null = null;
  let currentBlock = "";

  function flushBlock() {
    if (currentBlock.trim() && currentSection) {
      currentSection.bullets.push(currentBlock.trim());
    }
    currentBlock = "";
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // h1 = brief title
    if (trimmed.startsWith("# ") && !title) {
      title = trimmed.replace(/^# /, "");
      continue;
    }

    // Horizontal rule — just skip
    if (trimmed === "---") {
      continue;
    }

    // h2 or h3 = section heading
    if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
      flushBlock();
      if (currentSection && currentSection.bullets.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        heading: trimmed.replace(/^#{2,3} /, ""),
        bullets: [],
      };
      continue;
    }

    // Not in a section yet — skip
    if (!currentSection) continue;

    // Bullet point (- style)
    if (trimmed.startsWith("- ")) {
      flushBlock();
      currentSection.bullets.push(trimmed.replace(/^- /, ""));
      continue;
    }

    // Numbered bold entry (**1. Title**) — starts a new content block
    if (/^\*\*\d+\./.test(trimmed)) {
      flushBlock();
      currentBlock = trimmed;
      continue;
    }

    // Blank line — finalize current block
    if (trimmed === "") {
      flushBlock();
      continue;
    }

    // Continuation text — append to current block
    if (currentBlock) {
      currentBlock += "\n" + trimmed;
    } else {
      // Start a new plain-text block
      currentBlock = trimmed;
    }
  }

  // Flush remaining
  flushBlock();
  if (currentSection && currentSection.bullets.length > 0) {
    sections.push(currentSection);
  }

  return { title, sections };
}
