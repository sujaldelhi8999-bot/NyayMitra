"use client";

import { useState, useRef, useEffect, useId } from "react";
import type { Language } from "@/lib/i18n";

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
}: TouchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const id = useId();
  const triggerId = `${id}-trigger`;
  const listId = `${id}-list`;

  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        switch (e.key) {
          case "Escape":
            setIsOpen(false);
            triggerRef.current?.focus();
            break;
          case "ArrowDown":
            e.preventDefault();
            setHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1));
            break;
          case "ArrowUp":
            e.preventDefault();
            setHighlightedIndex((prev) => Math.max(prev - 1, -1));
            break;
          case "Enter":
          case " ":
            if (highlightedIndex >= 0) {
              e.preventDefault();
              onChange(options[highlightedIndex].value);
              setIsOpen(false);
              triggerRef.current?.focus();
            }
            break;
          case "Tab":
            setIsOpen(false);
            break;
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, highlightedIndex, options, onChange]);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

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
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setTimeout(() => setIsOpen(false), 100);
          }
        }}
        className={`
          w-full flex items-center justify-between gap-3 rounded-lg border px-4 py-3.5
          text-left text-base font-semibold min-h-[48px]
          transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
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
                onClick={() => { onChange(option.value); setIsOpen(false); }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`
                  px-4 py-3.5 text-base font-medium min-h-[48px]
                  transition-colors cursor-pointer
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

      <div
        className="fixed inset-0 z-40 md:hidden"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />
    </div>
  );
}