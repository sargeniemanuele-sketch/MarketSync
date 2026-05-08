const variants = {
  danger: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-600",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-brand-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50",
  primary: "bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-600",
  secondary:
    "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus-visible:ring-brand-600 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800",
};

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

export default function Button({
  as: Component = "button",
  children,
  className = "",
  isLoading = false,
  size = "md",
  type,
  variant = "primary",
  ...props
}) {
  const buttonProps = Component === "button" ? { type: type || "button" } : {};

  return (
    <Component
      className={[
        "ms-button inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-950",
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className,
      ].join(" ")}
      aria-busy={isLoading || undefined}
      data-ms-size={size}
      {...buttonProps}
      {...props}
    >
      {children}
    </Component>
  );
}
