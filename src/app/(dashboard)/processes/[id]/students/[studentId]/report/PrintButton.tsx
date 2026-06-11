"use client"

import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

export default function PrintButton() {
  return (
    <Button onClick={() => window.print()} size="sm">
      <Printer className="w-4 h-4" />
      Imprimir
    </Button>
  )
}
