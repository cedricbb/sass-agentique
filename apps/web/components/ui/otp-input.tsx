"use client";

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  name: string;
  autoFocus?: boolean;
}

export function OtpInput({ length = 6, name, autoFocus = false }: OtpInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...values];
    next[index] = digit;
    setValues(next);
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (values[index]) {
        const next = [...values];
        next[index] = "";
        setValues(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    const next = Array(length).fill("");
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setValues(next);
    const focusIdx = Math.min(pasted.length, length - 1);
    inputRefs.current[focusIdx]?.focus();
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {/* Hidden input soumis avec le formulaire */}
      <input type="hidden" name={name} value={values.join("")} />

      {values.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          autoFocus={autoFocus && i === 0}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={cn(
            "w-12 h-14 rounded-lg text-center text-2xl font-extrabold",
            "bg-muted border border-transparent",
            "outline-none transition-all duration-150",
            "hover:border-border",
            "focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20",
            digit && "bg-background border-primary/30",
          )}
        />
      ))}
    </div>
  );
}
