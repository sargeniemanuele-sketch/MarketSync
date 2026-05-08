import { useCallback, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

export default function InfoTooltip({
  ariaLabel,
  buttonClassName = "",
  children,
  className = "",
  widthClassName = "w-72",
  ...props
}) {
  const tooltipId = useId();
  const buttonRef = useRef(null);
  const [align, setAlign] = useState("left");

  const updateAlignment = useCallback(() => {
    const button = buttonRef.current;

    if (!button || typeof window === "undefined") {
      return;
    }

    const viewportPadding = 16;
    const tooltipWidth = Math.min(320, window.innerWidth - viewportPadding * 2);
    const { left } = button.getBoundingClientRect();

    setAlign(left + tooltipWidth > window.innerWidth - viewportPadding ? "right" : "left");
  }, []);

  return (
    <div className={["group/info-tooltip relative flex-none", className].join(" ")} {...props}>
      <button
        aria-describedby={tooltipId}
        aria-label={ariaLabel}
        className={[
          "flex h-6 w-6 items-center justify-center rounded-md text-slate-400 outline-none ring-brand-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200",
          buttonClassName,
        ].join(" ")}
        onFocus={updateAlignment}
        onMouseEnter={updateAlignment}
        ref={buttonRef}
        type="button"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <div
        className={[
          "pointer-events-auto absolute top-8 z-50 hidden max-w-[calc(100vw-2rem)] rounded-md border border-slate-200 bg-white p-3 text-left shadow-lg group-hover/info-tooltip:block group-focus-within/info-tooltip:block dark:border-slate-700 dark:bg-slate-950",
          "break-words [overflow-wrap:anywhere]",
          widthClassName,
          align === "right" ? "right-0" : "left-0",
        ].join(" ")}
        id={tooltipId}
        role="tooltip"
      >
        {children}
      </div>
    </div>
  );
}
