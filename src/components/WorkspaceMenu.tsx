"use client";

import { useEffect, useRef } from "react";
import {
  ArrowDownToLine,
  CircleHelp,
  Clock3,
  MoreHorizontal,
} from "lucide-react";
import { gsap } from "gsap";

export function WorkspaceMenu({
  onImports,
  onHelp,
  onExport,
  onInsights,
  onAudit,
}: {
  onImports: () => void;
  onHelp: () => void;
  onExport: () => void;
  onInsights: () => void;
  onAudit: () => void;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && menu.current)
        menu.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  function run(action: () => void) {
    menu.current!.open = false;
    action();
  }
  return (
    <details
      ref={menu}
      className="workspace-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          menu.current!.open = false;
          menu.current!.querySelector("summary")?.focus();
        }
      }}
      onToggle={(event) => {
        if (
          event.currentTarget.open &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          gsap.fromTo(
            event.currentTarget.querySelector(".workspace-popover"),
            { opacity: 0, y: -6, scale: 0.97 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.2,
              clearProps: "transform,opacity",
            },
          );
      }}
    >
      <summary className="icon-button" aria-label="Workspace options">
        <MoreHorizontal size={21} aria-hidden="true" />
      </summary>
      <div className="workspace-popover" data-liquid-glass>
        <span className="menu-caption">Workspace</span>
        <button onClick={() => run(onImports)}>
          <Clock3 size={16} />
          Import activity
        </button>
        <button onClick={() => run(onExport)}>
          <ArrowDownToLine size={16} />
          Export all trades
        </button>
        <button onClick={() => run(onInsights)}>
          <Clock3 size={16} />
          Session insights
        </button>
        <button onClick={() => run(onAudit)}>
          <Clock3 size={16} />
          Import verification
        </button>
        <span className="menu-separator" />
        <button onClick={() => run(onHelp)}>
          <CircleHelp size={16} />
          How Folio works
        </button>
      </div>
    </details>
  );
}
