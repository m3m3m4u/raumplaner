"use client";
import clsx from 'clsx';

export function Card({ className, children, padding=true, ...rest }) {
  return (
    <div className={clsx("bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow", padding && 'p-5', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children }) {
  return <div className={clsx("mb-4 flex items-start justify-between gap-4", className)}>{children}</div>;
}
export function CardTitle({ className, children }) {
  return <h3 className={clsx("text-lg font-semibold tracking-tight", className)}>{children}</h3>;
}
export function CardContent({ className, children }) {
  return <div className={clsx("space-y-4", className)}>{children}</div>;
}
