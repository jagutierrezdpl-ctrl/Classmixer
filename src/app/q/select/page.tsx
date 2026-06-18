"use client"
import LogoBrand from "@/components/ui/LogoBrand"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

function SelectContent() {
  const searchParams = useSearchParams()
  const tokens = (searchParams.get("tokens") ?? "").split(",").filter(Boolean)

  if (tokens.length === 0) {
    return (
      <p className="text-gray-500 text-sm">No se encontraron cuestionarios disponibles.</p>
    )
  }

  return (
    <div className="space-y-3 w-full">
      {tokens.map((token, i) => (
        <Link key={token} href={`/q/${token}`} className="block">
          <Button variant="outline" className="w-full h-14 text-base justify-start gap-3">
            <ClipboardList className="w-5 h-5 text-primary shrink-0" />
            Cuestionario {i + 1}
          </Button>
        </Link>
      ))}
    </div>
  )
}

export default function SelectQuestionnairePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <LogoBrand size="lg" />
        <h1 className="text-2xl font-bold mb-2">Elige tu cuestionario</h1>
        <p className="text-gray-500 text-sm mb-6">Tienes más de un cuestionario activo. Elige cuál quieres responder.</p>
        <Suspense fallback={<p className="text-gray-400 text-sm">Cargando...</p>}>
          <SelectContent />
        </Suspense>
      </div>
    </div>
  )
}
