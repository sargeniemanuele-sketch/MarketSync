import { useEffect, useState } from "react";

export function prefersReducedMotionFromApp() {
  if (typeof document === "undefined") {
    return false;
  }

  return document.documentElement.dataset.reduceMotion === "true";
}

export default function useReducedMotionPreference() {
  const [reduceMotion, setReduceMotion] = useState(prefersReducedMotionFromApp);

  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    const updateReduceMotion = () => {
      setReduceMotion(prefersReducedMotionFromApp());
    };
    const observer = new MutationObserver(updateReduceMotion);

    updateReduceMotion();
    observer.observe(root, {
      attributeFilter: ["data-reduce-motion"],
      attributes: true,
    });

    return () => observer.disconnect();
  }, []);

  return reduceMotion;
}
