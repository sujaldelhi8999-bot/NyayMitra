"use client";

import { useState, useRef, useEffect, useId, useCallback } from "react";


interface TouchSelectOption {
  value: string;
  label: string;
}

interface TouchSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: TouchSelectOption[];
  placeholder?: string;
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function TouchSelect({
  value,
  onChange,
  options,
  placeholder,
  label,
  ariaLabel,
  disabled = false,
  className = "",
  size = "md",
}: TouchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const justSelectedRef = useRef(false);
  const id = useId();
  const triggerId = `${id}-trigger`;
  const listId = `${id}-list`;

  const selectedOption = options.find((opt) => opt.value === value);

  const closeAndFocusTrigger = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const selectOption = useCallback((option: TouchSelectOption) => {
    justSelectedRef.current = true;
    onChange(option.value);
    setIsOpen(false);
    triggerRef.current?.focus();
    setTimeout(() => { justSelectedRef.current = false; }, 0);
  }, [onChange]);

  const handleKeyboardNavigation = useCallback((e: KeyboardEvent) => {
    const { key } = e;
    if (key === "Escape") {
      closeAndFocusTrigger();
      return;
    }
    if (key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1));
      return;
    }
    if (key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, -1));
      return;
    }
    if (key === "Enter" || key === " ") {
      if (highlightedIndex >= 0) {
        e.preventDefault();
        selectOption(options[highlightedIndex]);
      }
      return;
    }
    if (key === "Tab") {
      setIsOpen(false);
    }
  }, [closeAndFocusTrigger, highlightedIndex, options, selectOption]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyboardNavigation);
      return () => document.removeEventListener("keydown", handleKeyboardNavigation);
    }
  }, [isOpen, handleKeyboardNavigation]);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div className={`relative ${className}`}>
      {label && <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-expanded={isOpen}
        aria-labelledby={label ? undefined : ariaLabel}
        aria-label={!label ? ariaLabel : undefined}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onBlur={(e) => {
          if (justSelectedRef.current) return;
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setTimeout(() => setIsOpen(false), 100);
          }
        }}
        className={`
          w-full flex items-center justify-between gap-3 rounded-lg border
          text-left text-base font-semibold
          transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
          ${size === "sm" ? "px-4 py-2 min-h-[32px]" : "px-4 py-3.5 min-h-[48px]"}
          ${disabled
            ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
            : "bg-white border-slate-300 text-slate-900 hover:border-teal-400 shadow-sm"
          }
        `}
      >
        <span className={selectedOption ? "text-slate-900" : "text-slate-500"}>
          {selectedOption?.label ?? placeholder ?? "Select"}
        </span>
        <svg
          className={`size-5 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed z-50 left-0 right-0 mt-1 max-h-72 overflow-auto md:absolute md:left-auto md:right-0 md:w-full">
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={triggerId}
            className="rounded-lg border border-slate-300 bg-white shadow-lg overflow-hidden"
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                ref={(el) => { optionRefs.current[index] = el; }}
                role="option"
                aria-selected={option.value === value}
                onClick={() => selectOption(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`
                  ${size === "sm" ? "px-4 py-2 min-h-[32px] text-sm" : "px-4 py-3.5 min-h-[48px] text-base"}
                  font-medium transition-colors cursor-pointer
                  ${option.value === value
                    ? "bg-teal-50 text-teal-800"
                    : "text-slate-700 hover:bg-slate-50"
                  }
                  ${index === highlightedIndex && option.value !== value ? "bg-slate-100" : ""}
                `}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
