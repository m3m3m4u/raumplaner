"use client";
import clsx from 'clsx';

export default function PageHeader({ title, subtitle, actions, className }) {
  return (
    <div className={clsx("flex flex-wrap items-center justify-between gap-4 mb-8", className)}>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 max-w-prose">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
