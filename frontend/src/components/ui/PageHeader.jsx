export default function PageHeader({
  actions,
  className = "",
  description,
  eyebrow,
  meta,
  title,
}) {
  return (
    <div
      className={[
        "ms-page-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      ].join(" ")}
    >
      <div className="ms-page-header-copy min-w-0">
        {eyebrow ? (
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950 dark:text-slate-50">{title}</h1>
        {description ? (
          <p className="ms-page-header-description mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        ) : null}
        {meta ? <div className="ms-page-header-meta mt-3 flex flex-wrap gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="ms-page-header-actions flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
