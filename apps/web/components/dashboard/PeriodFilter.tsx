"use client";

import { Button } from "@/components/ui/button";

type Period = "7J" | "30J" | "3M" | "1A";

interface PeriodFilterProps {
  value: Period;
  onChange: (p: Period) => void;
}

const PERIODS: Period[] = ["7J", "30J", "3M", "1A"];

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <div className="flex items-center gap-1">
      {PERIODS.map((period) => (
        <Button
          key={period}
          variant={value === period ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(period)}
        >
          {period}
        </Button>
      ))}
    </div>
  );
}
