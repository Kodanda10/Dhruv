'use client';
import React from 'react';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
};

export default function Card({ children, className, as: Tag = 'div' }: CardProps) {
  return (
    <Tag
      className={[
        'bg-white border border-gray-200 rounded-xl shadow-[0_4px_20px_rgba(16,24,40,0.06)]',
        className || '',
      ].join(' ').trim()}
    >
      {children}
    </Tag>
  );
}


