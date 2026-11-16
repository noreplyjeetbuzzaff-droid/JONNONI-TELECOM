import React from 'react';

interface IndeterminateProgressBarProps {
  active: boolean;
  label?: string;
  className?: string;
}

export const IndeterminateProgressBar: React.FC<
  IndeterminateProgressBarProps
> = ({ active, label = 'ডাউনলোড প্রস্তুত হচ্ছে...', className = '' }) => {
  if (!active) return null;

  return (
    <div
      className={`w-full space-y-1.5 ${className}`}
      role="progressbar"
      aria-busy="true"
      aria-valuetext={label}
      aria-label={label}
    >
      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-sky-700">
        <span className="truncate">{label}</span>
        <span className="font-mono text-[10px] text-sky-600 shrink-0">
          অপেক্ষা করুন
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-sky-100">
        <div className="animate-indeterminate-bar h-full w-full origin-left rounded-full bg-gradient-to-r from-sky-500 via-sky-600 to-cyan-500" />
      </div>
    </div>
  );
};
