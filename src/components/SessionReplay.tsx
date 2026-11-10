"use client";
import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { Trade } from "../shared/types";
import { sessionBounds, tradesThrough } from "../shared/replay";
import { Dropdown } from "./Dropdown";
import "./SessionReplay.css";

export function useSessionReplay(trades: Trade[]) {
  const [snapshot, setSnapshot] = useState<Trade[] | null>(null);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("900");
  const bounds = useMemo(() => sessionBounds(snapshot ?? []), [snapshot]);
  const running = playing && at < bounds.end;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const delta = (now - last) * Number(speed);
      last = now;
      setAt((value) => Math.min(bounds.end, value + delta));
    }, 250);
    const pauseWhenHidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", pauseWhenHidden);
    };
  }, [running, speed, bounds.end]);
  const visible = useMemo(
    () => (snapshot ? tradesThrough(snapshot, at) : trades),
    [snapshot, at, trades],
  );
  return {
    enabled: snapshot !== null,
    bounds,
    at,
    playing: playing && at < bounds.end,
    speed,
    trades: visible,
    pending: snapshot ? trades.length - snapshot.length : 0,
    enter() {
      const next = sessionBounds(trades);
      setSnapshot(trades);
      setAt(next.start);
      setPlaying(false);
    },
    exit() {
      setSnapshot(null);
      setPlaying(false);
    },
    seek(value: number) {
      setAt(Math.min(bounds.end, Math.max(bounds.start, value)));
      setPlaying(false);
    },
    toggle() {
      if (at >= bounds.end) setAt(bounds.start);
      setPlaying((value) => !value || at >= bounds.end);
    },
    pause() {
      setPlaying(false);
    },
    setSpeed,
  };
}

export function SessionReplay({
  replay,
  disabled,
}: {
  replay: ReturnType<typeof useSessionReplay>;
  disabled: boolean;
}) {
  const stamp = (value: number) =>
    new Date(value).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
    });
  return (
    <section
      className={`session-replay ${replay.enabled ? "replaying" : ""}`}
      aria-label="Session replay"
    >
      <div className="replay-heading">
        <div>
          <strong>
            {replay.enabled ? "Reviewing historical trades" : "Session replay"}
          </strong>
          <p>
            {replay.enabled
              ? "Totals, charts and the blotter follow the playhead. Imports continue in the background."
              : "Revisit the saved session, one moment at a time."}
          </p>
        </div>
        <button
          className="secondary-button"
          disabled={disabled}
          onClick={replay.enabled ? replay.exit : replay.enter}
        >
          {replay.enabled ? "Return to all trades" : "Start replay"}
        </button>
      </div>
      {replay.enabled && (
        <div className="replay-controls">
          <button
            className="icon-button"
            aria-label={replay.playing ? "Pause replay" : "Play replay"}
            onClick={replay.toggle}
          >
            {replay.playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            className="icon-button"
            aria-label="Restart replay"
            onClick={() => replay.seek(replay.bounds.start)}
          >
            <RotateCcw size={16} />
          </button>
          <label className="replay-seek">
            <span>
              Replay time (IST) <output>{stamp(replay.at)}</output>
            </span>
            <input
              aria-label="Replay time"
              aria-valuetext={`${stamp(replay.at)} IST`}
              type="range"
              min={replay.bounds.start}
              max={replay.bounds.end}
              value={replay.at}
              onChange={(event) => replay.seek(Number(event.target.value))}
              onKeyDown={(event) => {
                if (
                  ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"].includes(
                    event.key,
                  )
                ) {
                  event.preventDefault();
                  replay.seek(
                    replay.at +
                      (["ArrowLeft", "ArrowDown"].includes(event.key)
                        ? -60000
                        : 60000),
                  );
                }
              }}
            />
          </label>
          <Dropdown
            label="Replay speed"
            value={replay.speed}
            onChange={replay.setSpeed}
            options={[
              { value: "60", label: "60×" },
              { value: "300", label: "300×" },
              { value: "900", label: "900×" },
            ]}
          />
          <span className="replay-count">
            {replay.trades.length.toLocaleString("en-IN")} trades
            {replay.pending > 0 && (
              <small>
                {replay.pending.toLocaleString("en-IN")} new trades waiting
                outside replay
              </small>
            )}
          </span>
        </div>
      )}
    </section>
  );
}
