import React from 'react';

/**
 * Renders assistant text safely:
 * - Converts newlines into <br />
 * - Parses **bold** segments into <strong> tags
 * - NEVER uses dangerouslySetInnerHTML
 */
export default function SafeText({ text = '', className = '' }) {
  if (!text || typeof text !== 'string') return null;

  const paragraphs = text.split('\n');

  return (
    <div className={`space-y-1.5 leading-relaxed break-words ${className}`}>
      {paragraphs.map((line, pIdx) => {
        if (!line.trim()) {
          return <div key={pIdx} className="h-1.5" />;
        }

        // Split on **bold** patterns
        const parts = line.split(/(\*\*[^*]+\*\*)/g);

        return (
          <p key={pIdx} className="min-h-[1.25rem]">
            {parts.map((part, partIdx) => {
              if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                return (
                  <strong key={partIdx} className="font-bold text-slate-900">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={partIdx}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}
