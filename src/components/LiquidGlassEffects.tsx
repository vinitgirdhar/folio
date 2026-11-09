"use client";

import Script from "next/script";
import { useEffect, useState, type RefObject } from "react";

type Glass = { supported: boolean; refresh: () => void; destroy: () => void };
declare global {
  interface Window {
    liquidGlass: (
      element: HTMLElement,
      options: {
        scale: number;
        chroma: number;
        border: number;
        blur: number;
        fallbackBlur: number;
      },
    ) => Glass;
  }
}

export function LiquidGlassEffects({
  root,
}: {
  root: RefObject<HTMLDivElement | null>;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready || !root.current) return;
    const container = root.current;
    const instances = new Map<HTMLElement, Glass>();
    function reconcile() {
      for (const [element, glass] of instances) {
        if (!container.contains(element)) {
          glass.destroy();
          instances.delete(element);
        }
      }
      for (const element of container.querySelectorAll<HTMLElement>(
        "[data-liquid-glass]",
      )) {
        if (!instances.has(element))
          instances.set(
            element,
            window.liquidGlass(element, {
              scale: -48,
              chroma: 2,
              border: 0.12,
              blur: 6,
              fallbackBlur: 20,
            }),
          );
      }
    }
    reconcile();
    const observer = new MutationObserver(reconcile);
    observer.observe(container, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      for (const glass of instances.values()) glass.destroy();
    };
  }, [ready, root]);
  return (
    <Script
      src="/vendor/liquid-glass.js"
      strategy="afterInteractive"
      onReady={() => setReady(true)}
    />
  );
}
