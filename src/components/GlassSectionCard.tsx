"use client";

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type GlassSectionCardProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

/**
 * Large-section container with liquid glass styling.
 * Applies stronger blur, gradient, and hover depth reserved for big dashboard panels.
 */
export default function GlassSectionCard({ children, className, ...props }: GlassSectionCardProps) {
  return (
    <div
      {...props}
      className={cn(
        'glass-section-card text-white',
        className
      )}
    >
      {children}
    </div>
  );
}
