"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Search, User, ChevronRight, Loader2 } from "lucide-react"
import Link from "next/link"

interface StudentProfile {
  id: string
  external_id: string
  first_name: string
  last_name: string
  birth_year: number | null
  created_at: string
}

export default function AlumnadoPage() {
  const [profiles, setProfiles] = useState<StudentProfile[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (debouncedQ) params.set("q", debouncedQ)
      const res = await fetch(`/api/student-profiles?${params}`)
      const data = await res.json()
      setProfiles(data.profiles ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedQ])

  useEffect(() => { load() }, [load])

  const pageSize = 50
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Alumnado</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Registro persistente de todos los alumnos del centro
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nombre, apellidos o ID..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Cargando...
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          {debouncedQ ? "No se encontraron resultados" : "No hay alumnos registrados todavía"}
          <p className="text-sm mt-1">
            Los perfiles se crean automáticamente al importar alumnos en un proceso
          </p>
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground mb-3">
            {total} alumno{total !== 1 ? "s" : ""}
          </div>

          <div className="space-y-2">
            {profiles.map(p => (
              <Card key={p.id} className="hover:bg-muted/30 transition-colors">
                <CardContent className="py-3 px-4">
                  <Link
                    href={`/alumnado/${p.id}`}
                    className="flex items-center gap-4"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {p.last_name}, {p.first_name}
                      </p>
                      <p className="text-xs text-muted-foreground">ID: {p.external_id}</p>
                    </div>
                    {p.birth_year && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {p.birth_year}
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
