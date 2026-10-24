"use client";

import React from "react";

interface FormattedMessageProps {
  content: string;
}

/**
 * Formats J.A.R.V.I.S. message content into rich elements, converting
 * markdown links [Title](url) into clickable, styled anchors and
 * formatting bold text and bulleted lists.
 */
export default function FormattedMessage({ content }: FormattedMessageProps) {
  if (!content) return null;

  // Split lines to preserve layout
  const lines = content.split("\n");

  return (
    <div className="formatted-msg-container">
      {lines.map((line, lineIdx) => {
        // Empty line spacer
        if (!line.trim()) {
          return <div key={lineIdx} className="formatted-spacer" />;
        }

        // Render line with parsed inline markdown tokens
        return (
          <div key={lineIdx} className="formatted-line">
            {renderInlineMarkdown(line)}
          </div>
        );
      })}
    </div>
  );
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Regex to match [title](url), **bold**, *italic*, or bare URLs
  const tokenRegex =
    /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)|\*\*([^*]+)\*\*|__([^_]+)_|\*([^*]+)\*|(https?:\/\/[^\s<]+)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    // Add text preceding the match
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      // Markdown link [title](url)
      const linkTitle = match[1];
      const linkUrl = match[2];
      elements.push(
        <a
          key={`link-${keyCounter++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hud-source-link"
          title={`Open verified source: ${linkUrl}`}
        >
          {linkTitle} ↗
        </a>
      );
    } else if (match[3] || match[4]) {
      // Bold **text** or __text__
      const boldText = match[3] || match[4];
      elements.push(
        <strong key={`bold-${keyCounter++}`} className="hud-bold-text">
          {boldText}
        </strong>
      );
    } else if (match[5]) {
      // Italic *text*
      elements.push(
        <em key={`italic-${keyCounter++}`} className="hud-italic-text">
          {match[5]}
        </em>
      );
    } else if (match[6]) {
      // Bare URL
      const rawUrl = match[6];
      elements.push(
        <a
          key={`rawlink-${keyCounter++}`}
          href={rawUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hud-source-link"
        >
          {rawUrl} ↗
        </a>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
}
