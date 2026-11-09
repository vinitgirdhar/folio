"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, MoveHorizontal } from "lucide-react";

export function ScrollRegion({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const guide = useRef<HTMLDivElement>(null);
  const hint = useId();
  const [edges, setEdges] = useState({ left: false, right: false });
  const [interacted, setInteracted] = useState(false);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = viewport.current!;
    function measure() {
      const next = {
        left: element.scrollLeft > 2,
        right:
          element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
      };
      setEdges((current) =>
        current.left === next.left && current.right === next.right
          ? current
          : next,
      );
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", measure);
    };
  }, []);
  useEffect(() => {
    if (!guide.current) return;
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry.isIntersecting),
    );
    observer.observe(guide.current);
    return () => observer.disconnect();
  }, [edges.left, edges.right]);
  function move(direction: number) {
    const element = viewport.current!;
    element.scrollBy({
      left: direction * Math.max(220, element.clientWidth * 0.7),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    setInteracted(true);
  }
  return (
    <div
      className="scroll-region"
      data-left={edges.left}
      data-right={edges.right}
    >
      <div
        ref={viewport}
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Trade table"
        aria-describedby={edges.left || edges.right ? hint : undefined}
        onScroll={() => setInteracted(true)}
      >
        {children}
      </div>
      {(edges.left || edges.right) && (
        <div
          ref={guide}
          className={`scroll-guide ${inView && !interacted ? "discover-scroll" : ""}`}
        >
          <span id={hint}>
            <MoveHorizontal size={15} aria-hidden="true" />
            <span>
              {edges.right
                ? "Swipe to explore all columns"
                : "You’ve reached the last column"}
            </span>
            <i className="scroll-cue" aria-hidden="true">
              <i />
            </i>
          </span>
          <div>
            <button
              type="button"
              className="icon-button"
              aria-label="Scroll table left"
              disabled={!edges.left}
              onClick={() => move(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Scroll table right"
              disabled={!edges.right}
              onClick={() => move(1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
