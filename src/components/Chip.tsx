'use client';
import React from 'react';

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  selected?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export default function Chip({ label, selected = false, icon, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={[
        'chip',
        selected ? 'chip--active' : '',
        'text-sm',
        className || '',
      ].join(' ').trim()}
      aria-pressed={selected}
      {...props}
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}


