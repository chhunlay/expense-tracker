"use client";

import { useState } from "react";

import { CategoryIcon, ICON_OPTIONS } from "@/lib/categoryIcons";

/** A swatch button that opens a small icon grid on click and closes on
 * mouse-leave or on picking an icon - same interaction as ColorPicker,
 * so choosing a category's icon feels like choosing its color. */
export default function IconPicker({
  value,
  onChange,
  swatchClassName = "h-9 w-10",
}: {
  value: string;
  onChange: (icon: string) => void;
  swatchClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Choose icon"
        className={`${swatchClassName} input flex flex-shrink-0 items-center justify-center rounded-lg`}
      >
        <CategoryIcon icon={value} width={18} height={18} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 pt-1.5">
          <div className="glass-card w-52 rounded-xl p-2.5 shadow-lg">
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  aria-label={label}
                  title={label}
                  className="input flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-transform hover:scale-110"
                  style={{
                    outline: value === key ? "2px solid var(--text-main)" : "none",
                    outlineOffset: 1,
                  }}
                >
                  <CategoryIcon icon={key} width={16} height={16} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
