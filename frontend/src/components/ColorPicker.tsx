"use client";

import { useState } from "react";

// Same palette as Settings' Accent color picker, so category colors and
// the accent color come from one consistent set.
const PRESET_COLORS = [
  "#f97316",
  "#6366f1",
  "#ec4899",
  "#10b981",
  "#06b6d4",
  "#eab308",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#64748b",
];

/** A swatch button that opens a small preset palette on click and
 * closes on mouse-leave - unlike the native `<input type="color">`
 * OS picker (a separate window on macOS/Windows), this is ours to
 * dismiss without a deliberate close click. A "+" custom option still
 * falls back to the native picker for anything outside the palette. */
export default function ColorPicker({
  value,
  onChange,
  swatchClassName = "h-9 w-10",
}: {
  value: string;
  onChange: (color: string) => void;
  swatchClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Choose color"
        className={`${swatchClassName} flex-shrink-0 rounded-lg border border-[var(--input-border)]`}
        style={{ background: value }}
      />
      {open && (
        <div className="glass-card absolute left-0 top-full z-20 mt-1.5 w-44 rounded-xl p-2.5 shadow-lg">
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onChange(color);
                  setOpen(false);
                }}
                aria-label={`Use ${color}`}
                className="h-6 w-6 flex-shrink-0 rounded-full transition-transform hover:scale-110"
                style={{
                  background: color,
                  outline: value.toLowerCase() === color ? "2px solid var(--text-main)" : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
            <label className="text-muted flex h-6 w-6 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-current text-[10px]">
              +
              <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
