import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'inline' | 'card' | 'overlay';
  label?: string;
  sublabel?: string;
  className?: string;
  showRing?: boolean;
}

const SIZE_MAP: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
  xl: 'h-11 w-11',
};

const RING_SIZE_MAP: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
  xs: 'h-3.5 w-3.5 border-2',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-[2.5px]',
  lg: 'h-10 w-10 border-[3px]',
  xl: 'h-12 w-12 border-[3px]',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'inline',
  label,
  sublabel,
  className = '',
  showRing = false,
}) => {
  const iconSizeClass = SIZE_MAP[size];
  const ringSizeClass = RING_SIZE_MAP[size];

  const spinnerGlyph = showRing ? (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 ${ringSizeClass} rounded-full border-current/20 border-t-current animate-spin`}
      aria-hidden="true"
    />
  ) : (
    <Loader2
      className={`${iconSizeClass} shrink-0 animate-spin`}
      aria-hidden="true"
    />
  );

  if (variant === 'overlay') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px] ${className}`}
      >
        <div className="flex w-full max-w-xs flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-6 text-center shadow-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600">
            <span
              className="h-8 w-8 rounded-full border-[3px] border-sky-200 border-t-sky-600 animate-spin"
              aria-hidden="true"
            />
          </div>
          {label && (
            <p className="mt-3 font-display text-sm font-bold text-slate-900">
              {label}
            </p>
          )}
          {sublabel && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {sublabel}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex flex-col items-center justify-center text-center ${className}`}
      >
        <div className="relative flex items-center justify-center">
          <span
            className={`${ringSizeClass} rounded-full border-sky-200 border-t-sky-600 animate-spin`}
            aria-hidden="true"
          />
        </div>
        {label && (
          <p className="mt-3 font-display text-sm font-semibold text-slate-900">
            {label}
          </p>
        )}
        {sublabel && (
          <p className="mt-1 text-xs text-slate-500">{sublabel}</p>
        )}
      </div>
    );
  }

  return (
    <span
      role={label ? 'status' : undefined}
      className={`inline-flex items-center gap-2 ${className}`}
    >
      {spinnerGlyph}
      {label && <span>{label}</span>}
    </span>
  );
};
