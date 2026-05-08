export default function Card({ as: Component = "section", children, className = "", ...props }) {
  return (
    <Component
      className={[
        "ms-card rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-6",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </Component>
  );
}
