"use client";
import clsx from 'clsx';

export default function PageHeader({ title, subtitle, actions, className }) {
  return (
    <div className={clsx("flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200/80", className)}>
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm font-medium text-slate-500 max-w-prose">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}
