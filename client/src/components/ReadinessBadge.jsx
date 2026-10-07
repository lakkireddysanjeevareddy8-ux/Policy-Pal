import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';

export default function ReadinessBadge({ readyCount, totalCount, percentage, size = 'md' }) {
  const percent = percentage !== undefined ? percentage : (totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 100);
  
  let colorTheme = {
    bar: 'bg-emerald-500',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    ring: 'stroke-emerald-500',
  };

  if (percent < 40) {
    colorTheme = {
      bar: 'bg-rose-500',
      text: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      ring: 'stroke-rose-500',
    };
  } else if (percent < 75) {
    colorTheme = {
      bar: 'bg-amber-500',
      text: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      ring: 'stroke-amber-500',
    };
  }

  if (size === 'sm') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${colorTheme.bar}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className={`text-xs font-semibold ${colorTheme.text}`}>{percent}%</span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-3 border ${colorTheme.bg} ${colorTheme.border}`}>
      <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
        <span className="flex items-center gap-1.5 text-slate-700">
          {percent === 100 ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <Clock className="w-4 h-4 text-amber-600" />
          )}
          <span>Readiness:</span>
          {readyCount !== undefined && totalCount !== undefined && (
            <span className="font-bold text-slate-900">
              {readyCount} of {totalCount} documents
            </span>
          )}
        </span>
        <span className={`font-extrabold text-sm ${colorTheme.text}`}>{percent}%</span>
      </div>

      {/* Animated progress bar */}
      <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${colorTheme.bar}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
