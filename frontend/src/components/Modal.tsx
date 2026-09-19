"use client";

import { useEffect, useRef } from "react";

interface Props {
  id: string;
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/** Same popup pattern the old Django pages used for "+ Add" (native
 * <dialog>, click-outside-to-close, Escape handled for free by the
 * browser) - a controlled `open` prop drives showModal()/close() so the
 * calling page can reset its form state on open/close the way the old
 * openModal() JS helper reset the form. */
export default function Modal({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="w-[calc(100%-2rem)] max-w-md bg-transparent p-0"
    >
      <div className="glass-card rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted text-xl leading-none hover:text-slate-100"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
