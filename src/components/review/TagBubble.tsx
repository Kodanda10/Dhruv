'use client';

import clsx from 'clsx';

interface TagBubbleProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}

export default function TagBubble({ label, selected = false, onClick }: TagBubbleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
        selected
          ? 'bg-mint-green/20 text-mint-green border-mint-green'
          : 'bg-white/20 text-white border-white/30 hover:border-white/60',
      )}
    >
      {label}
    </button>
  );
}
