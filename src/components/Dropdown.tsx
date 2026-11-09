"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { gsap } from "gsap";

type Option = { value: string; label: string };

export function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const typeahead = useRef({ value: "", time: 0 });
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  function position() {
    const button = trigger.current!,
      panel = popup.current!;
    const rect = button.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 190), innerWidth - 24);
    const height = Math.min(options.length * 40 + 16, 280, innerHeight - 24);
    panel.style.width = `${width}px`;
    panel.style.maxHeight = `${height}px`;
    panel.style.left = `${Math.max(12, Math.min(rect.right - width, innerWidth - width - 12))}px`;
    panel.style.top = `${Math.max(12, rect.bottom + height + 8 < innerHeight ? rect.bottom + 8 : rect.top - height - 8)}px`;
  }
  function show(index = selected) {
    if (!popup.current!.matches(":popover-open")) trigger.current!.click();
    setHighlighted(index);
  }
  function choose(index: number) {
    onChange(options[index].value);
    popup.current?.hidePopover();
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const { key } = event;
    const isOpen = popup.current!.matches(":popover-open");
    if (key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      popup.current?.hidePopover();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(key)) {
      event.preventDefault();
      if (!isOpen) {
        show(
          key === "End" ? options.length - 1 : key === "Home" ? 0 : selected,
        );
        return;
      }
      if (key === "Enter" || key === " ") {
        choose(highlighted);
        return;
      }
      setHighlighted((index) =>
        key === "Home"
          ? 0
          : key === "End"
            ? options.length - 1
            : (index + (key === "ArrowDown" ? 1 : -1) + options.length) %
              options.length,
      );
    } else if (key === "Tab") {
      popup.current?.hidePopover();
    } else if (
      key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const now = Date.now();
      typeahead.current = {
        value:
          (now - typeahead.current.time < 600 ? typeahead.current.value : "") +
          key.toLowerCase(),
        time: now,
      };
      const index = options.findIndex((option) =>
        option.label.toLowerCase().startsWith(typeahead.current.value),
      );
      if (index >= 0) {
        event.preventDefault();
        show(index);
      }
    }
  }
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (
        !(event.target instanceof Node) ||
        !popup.current?.contains(event.target)
      )
        popup.current?.hidePopover();
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);
  useEffect(() => {
    if (open)
      popup.current?.children[highlighted]?.scrollIntoView({
        block: "nearest",
      });
  }, [open, highlighted]);

  return (
    <div className="dropdown">
      <button
        ref={trigger}
        type="button"
        popoverTarget={id}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={open ? `${id}-${highlighted}` : undefined}
        className="dropdown-trigger"
        data-liquid-glass
        onClick={() => {
          position();
          setHighlighted(selected);
        }}
        onKeyDown={onKeyDown}
      >
        <span>{options[selected].label}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <div
        ref={popup}
        id={id}
        popover="auto"
        role="listbox"
        aria-label={label}
        className="dropdown-popover"
        data-liquid-glass
        onToggle={(event) => {
          const opening = event.newState === "open";
          setOpen(opening);
          if (
            opening &&
            !matchMedia("(prefers-reduced-motion: reduce)").matches
          )
            gsap.fromTo(
              event.currentTarget,
              { opacity: 0, y: -5, scale: 0.97 },
              {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.2,
                ease: "power2.out",
                clearProps: "transform,opacity",
              },
            );
        }}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            id={`${id}-${index}`}
            role="option"
            aria-selected={option.value === value}
            className={`dropdown-option ${highlighted === index ? "highlighted" : ""}`}
            onPointerMove={() => setHighlighted(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(index)}
          >
            <span>{option.label}</span>
            {option.value === value && <Check size={15} aria-hidden="true" />}
          </div>
        ))}
      </div>
    </div>
  );
}
