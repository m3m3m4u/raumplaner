"use client";
import clsx from 'clsx';

const base = "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed gap-2 select-none active:scale-[0.98]";
const variants = {
  primary: "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-md shadow-indigo-500/20 focus:ring-indigo-500",
  secondary: "bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 focus:ring-indigo-400 shadow-2xs",
  subtle: "bg-slate-100/90 text-slate-700 hover:bg-slate-200/90 focus:ring-slate-400",
  danger: "bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white shadow-md shadow-red-500/20 focus:ring-red-500",
  emerald: "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-md shadow-emerald-500/20 focus:ring-emerald-500"
};
const sizes = {
  xs: "h-7 px-2.5 text-[11px]",
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-base"
};

export default function Button({ as: Comp = 'button', variant = 'primary', size = 'md', className, ...props }) {
  const sizeClass = sizes[size] || sizes.md;
  return <Comp className={clsx(base, variants[variant] || variants.primary, sizeClass, className)} {...props} />;
}
