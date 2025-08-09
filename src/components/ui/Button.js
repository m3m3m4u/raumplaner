"use client";
import clsx from 'clsx';

const base = "inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed gap-2 select-none";
const variants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
  secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-400",
  subtle: "bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
};
const sizes = {
  xs: "h-7 px-2.5 text-[11px] leading-none",
  sm: "h-8 px-3 text-xs leading-tight",
  md: "h-10 px-4 text-sm leading-tight",
  lg: "h-11 px-6 text-base leading-tight"
};

export default function Button({ as:Comp='button', variant='primary', size='md', className, ...props }) {
  const sizeClass = sizes[size] || sizes.md;
  return <Comp className={clsx(base, variants[variant], sizeClass, className)} {...props} />;
}
