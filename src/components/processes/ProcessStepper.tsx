"use client"

import Link from "next/link"
import { Check, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
  label: string
  href: string
  done: boolean
  current?: boolean
  optional?: boolean
}

interface Props {
  processId: string
  steps: Step[]
}

export function ProcessStepper({ processId, steps }: Props) {
  const firstIncomplete = steps.findIndex(s => !s.done)
  const stepsWithCurrent = steps.map((s, i) => ({
    ...s,
    current: !s.done && i === firstIncomplete,
  }))

  return (
    <div className="mb-8 overflow-x-auto">
      <div className="flex items-center min-w-max">
        {stepsWithCurrent.map((step, idx) => (
          <div key={step.href} className="flex items-center">
            <Link
              href={`/processes/${processId}/${step.href}`}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors",
                step.done && "text-green-700 bg-green-50 hover:bg-green-100",
                step.current && "text-primary bg-primary/10 hover:bg-primary/15 font-medium",
                !step.done && !step.current && "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <span className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0",
                step.done && "bg-green-500 text-white",
                step.current && "bg-primary text-white",
                !step.done && !step.current && "border-2 border-muted-foreground/30 text-muted-foreground",
              )}>
                {step.done ? <Check className="w-3 h-3" /> : <span>{idx + 1}</span>}
              </span>
              <span className="whitespace-nowrap">
                {step.label}
                {step.optional && <span className="text-xs ml-1 opacity-60">(opcional)</span>}
              </span>
            </Link>
            {idx < stepsWithCurrent.length - 1 && (
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 mx-1 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
