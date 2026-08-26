import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn("p-1 hover:bg-[var(--dash-bg)]/5 dark:hover:bg-white/10 rounded transition-colors inline-flex items-center justify-center", className)}
      title="Copy to clipboard"
    >
      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />}
    </button>
  );
}
