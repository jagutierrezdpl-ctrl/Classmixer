"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { GraduationCap, Loader2, CheckCircle2, AlertTriangle, Search, X, Users, User } from "lucide-react"

interface Group {
  name: string
  count: number
  female: number
  male: number
  with_needs: number
}

interface ProfileResult {
  id: string
  external_id?: string
  first_name: string
  last_name: string
  current_class?: string
  gender?: string
  average_grade?: number
  academic_level?: string
  behavior_level?: string
  needs_type?: string
  email?: string
  already_in_process: boolean
}

interface Props {
  processId: string
  open: boolean
  onClose: () => void
  onImported: () => void
}

export default function LoadFromProfilesDialog({ processId, open, onClose, onImported }: Props) {
  const [mode, setMode] = useState<"group" | "individual">("group")

  // Group mode
  const [groups, setGroups] = useState<Group[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Individual mode
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<ProfileResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedProfiles, setSelectedProfiles] = useState<ProfileResult[]>([])
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Shared
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ added: number; skipped: number; message?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoadingGroups(true)
    fetch("/api/student-profiles/groups")
      .then(r => r.json())
      .then(d => setGroups(Array.isArray(d) ? d : []))
      .finally(() => setLoadingGroups(false))
  }, [open])

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current)
    if (search.length < 2) { setSearchResults([]); return }
    searchRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/processes/${processId}/load-from-profiles/search?q=${encodeURIComponent(search)}`)
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : [])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [search, processId])

  function toggleGroup(name: string) {
    setSelected(s => {
      const next = new Set(s)
      if (next.has(name)) { next.delete(name) } else { next.add(name) }
      return next
    })
  }

  function toggleProfile(p: ProfileResult) {
    if (p.already_in_process) return
    setSelectedProfiles(prev =>
      prev.some(x => x.id === p.id) ? prev.filter(x => x.id !== p.id) : [...prev, p]
    )
  }

  async function handleLoad() {
    setLoading(true)
    setError(null)
    try {
      let body: object
      if (mode === "group") {
        if (selected.size === 0) return
        body = { groups: Array.from(selected) }
      } else {
        if (selectedProfiles.length === 0) return
        body = { profile_ids: selectedProfiles.map(p => p.id) }
      }

      const res = await fetch(`/api/processes/${processId}/load-from-profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
        if (data.added > 0) onImported()
      }
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setSelected(new Set())
    setSelectedProfiles([])
    setSearch("")
    setSearchResults([])
    setResult(null)
    setError(null)
    setMode("group")
    onClose()
  }

  const totalGroupStudents = groups
    .filter(g => selected.has(g.name))
    .reduce((sum, g) => sum + g.count, 0)

  const canLoad = mode === "group" ? selected.size > 0 : selectedProfiles.length > 0

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Cargar desde Alumnado
          </DialogTitle>
          <DialogDescription className="sr-only">
            Añade alumnos del registro central a este proceso
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-lg">{result.added} alumnos añadidos</p>
            {result.skipped > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {result.skipped} omitidos (ya estaban en el proceso)
              </p>
            )}
            {result.message && (
              <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
            )}
          </div>
        ) : (
          <div className="py-2 space-y-3">
            {/* Mode toggle */}
            <div className="flex rounded-lg border p-1 gap-1">
              <button
                type="button"
                onClick={() => setMode("group")}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                  mode === "group" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Users className="w-4 h-4" /> Por grupo
              </button>
              <button
                type="button"
                onClick={() => setMode("individual")}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                  mode === "individual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <User className="w-4 h-4" /> Alumno individual
              </button>
            </div>

            {/* GROUP MODE */}
            {mode === "group" && (
              loadingGroups ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />Cargando grupos...
                </div>
              ) : groups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No hay grupos en el registro de alumnado.</p>
                  <p className="text-xs mt-1">Importa alumnos en la sección Alumnado primero.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {groups.map(g => (
                    <button
                      key={g.name}
                      type="button"
                      onClick={() => toggleGroup(g.name)}
                      className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                        selected.has(g.name) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{g.name}</p>
                          <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{g.count} alumnos</span>
                            {g.female > 0 && <span className="text-pink-600">{g.female}F</span>}
                            {g.male > 0 && <span className="text-blue-600">{g.male}M</span>}
                            {g.with_needs > 0 && (
                              <span className="text-amber-600 flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3" />{g.with_needs}
                              </span>
                            )}
                          </div>
                        </div>
                        {selected.has(g.name) && (
                          <Badge className="bg-primary/10 text-primary border-0 text-xs">✓</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )
            )}

            {/* INDIVIDUAL MODE */}
            {mode === "individual" && (
              <div className="space-y-3">
                {/* Selected chips */}
                {selectedProfiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProfiles.map(p => (
                      <span key={p.id} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        {p.last_name}, {p.first_name}
                        {p.current_class && <span className="opacity-60 ml-0.5">· {p.current_class}</span>}
                        <button type="button" onClick={() => setSelectedProfiles(prev => prev.filter(x => x.id !== p.id))}
                          className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-primary/20">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o apellidos..."
                    className="pl-9"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                  />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                </div>

                {/* Results */}
                {search.length >= 2 && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {searchResults.length === 0 && !searching ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Sin resultados</p>
                    ) : (
                      searchResults.map(p => {
                        const isSelected = selectedProfiles.some(x => x.id === p.id)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleProfile(p)}
                            disabled={p.already_in_process}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                              p.already_in_process
                                ? "opacity-40 cursor-not-allowed bg-muted/20"
                                : isSelected
                                  ? "bg-primary/5 text-primary"
                                  : "hover:bg-muted/50"
                            }`}
                          >
                            <div>
                              <span className={isSelected ? "font-medium" : ""}>{p.last_name}, {p.first_name}</span>
                              {p.current_class && <span className="text-xs text-muted-foreground ml-2">{p.current_class}</span>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {p.already_in_process && <span className="text-xs text-muted-foreground">Ya añadido</span>}
                              {isSelected && !p.already_in_process && <span className="text-primary text-xs">✓</span>}
                              {p.gender && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${p.gender === "F" ? "bg-pink-100 text-pink-700" : p.gender === "M" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}>
                                  {p.gender}
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
                {search.length > 0 && search.length < 2 && (
                  <p className="text-xs text-muted-foreground text-center">Escribe al menos 2 letras para buscar</p>
                )}
              </div>
            )}

            {/* Summary */}
            {mode === "group" && selected.size > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                {selected.size} grupo{selected.size !== 1 ? "s" : ""} · ~{totalGroupStudents} alumnos
              </p>
            )}
            {mode === "individual" && selectedProfiles.length > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                {selectedProfiles.length} alumno{selectedProfiles.length !== 1 ? "s" : ""} seleccionado{selectedProfiles.length !== 1 ? "s" : ""}
              </p>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={handleClose}>Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleLoad} disabled={!canLoad || loading || loadingGroups}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === "group"
                  ? `Añadir ${totalGroupStudents > 0 ? `${totalGroupStudents} alumnos` : ""}`
                  : `Añadir ${selectedProfiles.length > 0 ? `${selectedProfiles.length} alumno${selectedProfiles.length !== 1 ? "s" : ""}` : ""}`
                }
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
