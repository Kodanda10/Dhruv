'use client';
import React from 'react';

type SoftButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

export default function SoftButton({ children, onClick, disabled, className, ariaLabel }: SoftButtonProps) {
  return (
    <button
      type="button"
      className={[
        'inline-flex items-center gap-2 px-3.5 py-2 text-sm',
        'rounded-full border border-gray-200',
        'bg-green-50 hover:bg-green-100 text-slate-900',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className || '',
      ].join(' ').trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}


