import React from 'react';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/colors';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    // Use official theme colors - VERBATIM REQUIRED
    const variantStyles = {
      primary: 'bg-[#5D3FD3] text-white hover:bg-[#8B1A8B] focus:ring-[#5D3FD3]',
      secondary: 'bg-[var(--nav-bg)] text-gray-800 hover:bg-[color-mix(in_srgb,var(--nav-bg),black_10%)] focus:ring-gray-300',
      success: 'bg-[var(--approved)] text-white hover:bg-[color-mix(in_srgb,var(--approved),black_10%)] focus:ring-[var(--approved)]',
      danger: 'bg-[var(--rejected)] text-white hover:bg-[color-mix(in_srgb,var(--rejected),black_10%)] focus:ring-[var(--rejected)]',
      ghost: 'bg-transparent text-white hover:bg-white/10 border border-white/20 focus:ring-[#8BF5E6]/50',
    } as const;
    
    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };
    
    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;

