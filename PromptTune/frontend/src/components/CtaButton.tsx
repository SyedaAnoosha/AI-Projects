// src/components/CtaButton.tsx
import React from 'react';

type CtaButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  loading?: boolean;
  loadingLabel?: React.ReactNode;
};

export default function CtaButton({ children, loading, loadingLabel = '…', className = '', ...rest }: CtaButtonProps) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`cta-button ${className}`.trim()}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}