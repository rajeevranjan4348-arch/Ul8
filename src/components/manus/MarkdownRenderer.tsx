import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Simple fallback helper for cn if we do not use shadcn style utils
function localCn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // Pre-process content to remove internal chart data JSON blocks
  const processedContent = content.replace(/```json\n([\s\S]*?)\n```/g, (match, p1) => {
    try {
      const parsed = JSON.parse(p1);
      const chartData = parsed.data || parsed;
      if (chartData.labels && chartData.datasets) {
        return ''; // Hide chart data JSON
      }
    } catch (e) {
      // Not valid JSON or not chart data, keep it
    }
    return match;
  });

  return (
    <div className={localCn("prose prose-neutral max-w-none dark:prose-invert", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
