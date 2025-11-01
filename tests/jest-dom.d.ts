/// <reference types="@testing-library/jest-dom" />

import '@testing-library/jest-dom';

// Type augmentation for jest-dom matchers to fix TypeScript errors
declare global {
  namespace jest {
    interface Expect {
      toBeInTheDocument(): void;
      toHaveClass(...classNames: string[]): void;
      toHaveAttribute(attr: string, value?: string): void;
      toHaveTextContent(text: string | RegExp): void;
    }
    interface Matchers<R = void> {
      toBeInTheDocument(): R;
      toHaveClass(...classNames: string[]): R;
      toHaveAttribute(attr: string, value?: string): R;
      toHaveTextContent(text: string | RegExp): R;
      not: Matchers<R>;
    }
  }
}

export {};

