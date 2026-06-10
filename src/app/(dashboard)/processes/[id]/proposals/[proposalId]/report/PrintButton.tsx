"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function PrintButton() {
  return (
    <Button onClick={() => window.print()} size="sm" className="gap-2">
      <Printer className="w-4 h-4" />
      Imprimir / Guardar PDF
    </Button>
  )
}
