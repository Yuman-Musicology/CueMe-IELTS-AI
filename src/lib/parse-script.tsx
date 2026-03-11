import React from "react";

type Token =
  | { type: "section"; content: string }
  | { type: "mark"; content: string }
  | { type: "bold"; content: string }
  | { type: "emphasis"; content: string }
  | { type: "ellipsis" }
  | { type: "text"; content: string };

/**
 * Ordered alternation — first match wins:
 *   1. *(section header)*    →  paragraph sub-heading
 *   2. <mark>text</mark>     →  yellow highlight
 *   3. **text**              →  bold vocabulary
 *   4. [word]                →  stress / emphasis
 *   5. ...                   →  spoken pause
 */
const TOKEN_RE =
  /\*\(([^)]+)\)\*|<mark>([\s\S]*?)<\/mark>|\*\*([\s\S]*?)\*\*|\[([^\]]+)\]|(\.{3})/g;

function tokenize(script: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  for (const m of script.matchAll(TOKEN_RE)) {
    const idx = m.index!;

    if (idx > cursor) {
      tokens.push({ type: "text", content: script.slice(cursor, idx) });
    }

    if (m[1] != null) tokens.push({ type: "section", content: m[1] });
    else if (m[2] != null) tokens.push({ type: "mark", content: m[2] });
    else if (m[3] != null) tokens.push({ type: "bold", content: m[3] });
    else if (m[4] != null) tokens.push({ type: "emphasis", content: m[4] });
    else tokens.push({ type: "ellipsis" });

    cursor = idx + m[0].length;
  }

  if (cursor < script.length) {
    tokens.push({ type: "text", content: script.slice(cursor) });
  }

  return tokens;
}

/**
 * Converts the LLM-generated script markup into styled React nodes.
 *
 *  `<mark>`   → #FACC15 background highlight
 *  `[word]`   → bold + italic stress
 *  `...`      → soft gray pause
 *  `**word**` → bold vocabulary callout
 *  `*(head)*` → paragraph section header
 */
export function parseScript(script: string): React.ReactNode[] {
  return tokenize(script).map((t, i) => {
    switch (t.type) {
      case "section":
        return (
          <span
            key={i}
            className="block mt-6 mb-1 text-xs font-semibold uppercase tracking-widest text-[#ADADAD]"
          >
            {t.content}
          </span>
        );

      case "mark":
        return (
          <mark
            key={i}
            className="bg-[#FACC15] text-[#1A1A1A] px-1.5 py-0.5 rounded-md font-semibold"
            style={{ textDecoration: "none" }}
          >
            {t.content}
          </mark>
        );

      case "bold":
        return (
          <strong
            key={i}
            className="font-bold text-[#1A1A1A] underline decoration-[#FACC15]/50 decoration-2 underline-offset-2"
          >
            {t.content}
          </strong>
        );

      case "emphasis":
        return (
          <em
            key={i}
            className="not-italic font-bold text-[#1A1A1A] bg-[#F5F2ED] px-1 py-0.5 rounded"
          >
            {t.content}
          </em>
        );

      case "ellipsis":
        return (
          <span
            key={i}
            className="inline-block mx-1 text-[#D4D0CA] tracking-[0.25em] select-none"
            aria-hidden="true"
          >
            ...
          </span>
        );

      case "text":
        return <span key={i}>{t.content}</span>;
    }
  });
}
