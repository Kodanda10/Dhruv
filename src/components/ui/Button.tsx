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
    
    const variantStyles = {
      primary: `bg-[${colors.primary.green}] text-white hover:bg-[#0ea370] focus:ring-[${colors.primary.green}]`,
      secondary: `bg-[${colors.gray[200]}] text-[${colors.gray[800]}] hover:bg-[${colors.gray[300]}] focus:ring-[${colors.gray[400]}]`,
      success: `bg-[${colors.semantic.success}] text-white hover:bg-[#0ea370] focus:ring-[${colors.semantic.success}]`,
      danger: `bg-[${colors.semantic.error}] text-white hover:bg-[#dc2626] focus:ring-[${colors.semantic.error}]`,
      ghost: `bg-transparent text-[${colors.gray[700]}] hover:bg-[${colors.gray[100]}] focus:ring-[${colors.gray[300]}]`,
    };
    
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

