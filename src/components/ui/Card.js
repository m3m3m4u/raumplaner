"use client";
import clsx from 'clsx';

export function Card({ className, children, padding = true, ...rest }) {
  return (
    <div
      className={clsx(
        "glass-card rounded-2xl transition-all duration-300 overflow-hidden",
        padding && 'p-5',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }) {
  return <div className={clsx("mb-3 flex items-start justify-between gap-4", className)}>{children}</div>;
}

export function CardTitle({ className, children }) {
  return <h3 className={clsx("text-base font-bold tracking-tight text-slate-900", className)}>{children}</h3>;
}

export function CardContent({ className, children }) {
  return <div className={clsx("space-y-3", className)}>{children}</div>;
}
