"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value?: [number]
  onValueChange?: (value: [number]) => void
  min?: number
  max?: number
  step?: number
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
    const currentValue = value?.[0] ?? min
    const pct = ((currentValue - min) / (max - min)) * 100

    return (
      <div className={cn("relative flex items-center w-full", className)}>
        <div className="relative w-full h-2 rounded-full bg-muted">
          <div
            className="absolute h-full rounded-full bg-primary"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={e => onValueChange?.([Number(e.target.value)])}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          {...props}
        />
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }
