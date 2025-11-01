import React from 'react';
import { cn } from '@/lib/utils';

export interface TagBubbleProps {
  label: string;
  selected?: boolean;
  onToggle?: () => void;
}

export default function TagBubble({ label, selected, onToggle }: TagBubbleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'rounded-full px-4 py-1.5 text-sm transition',
        'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300',
        selected && 'ring-2 ring-green-500 border border-green-600'
      )}
      aria-pressed={!!selected}
    >
      {label}
    </button>
  );
}


