"use client";

import { useEffect, useRef } from "react";
import { Check, ChevronRight, Download, TriangleAlert, X } from "lucide-react";
import { gsap } from "gsap";
import type { Pull } from "../shared/types";
import "./ImportProgress.css";

export function ImportProgress({
  pull,
  connected,
  onOpen,
  onDismiss,
}: {
  pull: Pull;
  connected: boolean;
  onOpen?: () => void;
  onDismiss?: () => void;
}) {
  const card = useRef<HTMLElement>(null);
  const running = pull.status === "running";
  const completed = pull.status === "completed";
  const percent = completed
    ? 100
    : Math.round((pull.nextPage / pull.totalPages) * 100);
  const title = running
    ? "Importing your trades"
    : completed
      ? "Your trades are ready"
      : "This import needs attention";
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = gsap.fromTo(
      card.current,
      { opacity: 0, y: 8, scale: 0.99 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.4,
        ease: "power3.out",
        clearProps: "transform,opacity",
      },
    );
    return () => {
      animation.revert();
    };
  }, [pull.status]);

  return (
    <section
      ref={card}
      className="import-live-card"
      aria-label="Trade import progress"
      data-import-state={pull.status}
      data-connected={connected}
    >
      <div
        className="import-meter"
        role="progressbar"
        aria-label="Trades received"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}%${running && !connected ? ", last confirmed progress; reconnecting" : ""}`}
      >
        <svg viewBox="0 0 84 84" aria-hidden="true">
          <circle className="import-ring-track" cx="42" cy="42" r="35" />
          <circle
            className="import-ring-value"
            cx="42"
            cy="42"
            r="35"
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset={100 - percent}
          />
        </svg>
        {running && (
          <span className="import-orbit" aria-hidden="true">
            <i />
          </span>
        )}
        <span className="import-meter-value" aria-hidden="true">
          {completed ? (
            <Check size={28} />
          ) : pull.status === "failed" ? (
            <TriangleAlert size={24} />
          ) : (
            <>
              {percent}
              <small>%</small>
            </>
          )}
        </span>
      </div>
      <div className="import-live-content">
        <div className="import-live-heading">
          <h2 aria-live="polite">{title}</h2>
          {running && (
            <span className="import-signal" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((index) => (
                <i
                  key={index}
                  style={{ animationDelay: `${index * -0.15}s` }}
                />
              ))}
            </span>
          )}
          <span className="import-live-badge">
            {running
              ? connected
                ? "In progress"
                : "Reconnecting"
              : completed
                ? "Complete"
                : "Interrupted"}
          </span>
        </div>
        <p>
          {running
            ? connected
              ? "New trades are arriving. Keep exploring your saved trades."
              : "The import continues in the background. Reconnecting to live progress."
            : completed
              ? `${pull.inserted.toLocaleString("en-IN")} new trades added to your dashboard.`
              : pull.error ||
                "Your saved trades are safe. Start a new pull to try again."}
        </p>
        <div className="import-live-track" aria-hidden="true">
          <span style={{ width: `${percent}%` }}>{running && <i />}</span>
        </div>
        <div className="import-live-caption">
          <span>
            <Download size={12} />
            {running
              ? connected
                ? "Receiving trade data"
                : "Showing last confirmed progress"
              : completed
                ? "Saved and published"
                : "Existing trades preserved"}
          </span>
          <strong>{percent}%</strong>
        </div>
      </div>
      {onOpen && (
        <button className="import-view-button" onClick={onOpen}>
          View progress
          <ChevronRight size={15} />
        </button>
      )}
      {!running && onDismiss && (
        <button
          className="icon-button import-dismiss"
          aria-label="Dismiss import update"
          onClick={onDismiss}
        >
          <X size={16} />
        </button>
      )}
    </section>
  );
}
