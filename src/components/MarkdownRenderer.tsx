import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '../contexts/ThemeContext';

interface MarkdownRendererProps {
  content: string;
  forceInvert?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, forceInvert }) => {
  const { isDarkMode } = useTheme();
  return (
    <div className={`prose prose-sm md:prose-base max-w-none ${(isDarkMode || forceInvert) ? 'prose-invert' : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
};
