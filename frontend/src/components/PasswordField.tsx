"use client";

import { useState } from "react";

import { EyeIcon, EyeOffIcon } from "./icons";

interface Props {
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  autoFocus?: boolean;
}

/** Same show/hide toggle the old Django login/register pages had. */
export default function PasswordField({ value, onChange, minLength, autoFocus }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field relative">
      <input
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input w-full rounded-xl py-2.5 pl-3 pr-10 text-sm"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="password-toggle-btn absolute right-2.5 top-1/2 flex -translate-y-1/2"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
