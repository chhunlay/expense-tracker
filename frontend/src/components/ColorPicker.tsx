"use client";

import { useState } from "react";

// A wide enough spread of colors that picking one never needs to fall
// back to the native `<input type="color">` OS picker - that one opens
// as a separate window on macOS/Windows and needs its own explicit
// close, which is exactly the friction this component exists to avoid.
const PRESET_COLORS = [
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#ef4444",
  "#64748b",
];

/** A swatch button that opens a small preset palette on click and
 * closes on mouse-leave or on picking a color - no native OS picker
 * involved, so there's never a separate window to close. */
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
        // The visible gap to the button below is padding-top here, not
        // a margin - a margin would leave a dead zone the pointer falls
        // through on its way down, exiting this element's hover box and
        // closing the popover before the mouse ever reaches it.
        <div className="absolute left-0 top-full z-20 pt-1.5">
          <div className="glass-card w-44 rounded-xl p-2.5 shadow-lg">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
