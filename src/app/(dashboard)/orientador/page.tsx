"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, Heart, UserX, BookOpen, User, ChevronRight, Loader2, ShieldAlert } from "lucide-react"
import Link from "next/link"

interface StudentSummary {
  id: string
  first_name: string
  last_name: string
  external_id: string
  current_class: string | null
  gender: string | null
  behavior_level: string | null
  needs_type: string | null
  active: boolean
  observations: string | null
}

interface Overview {
  behavior_alert: StudentSummary[]
  needs_alert: StudentSummary[]
  no_class: StudentSummary[]
  inactive: StudentSummary[]
  totals: {
    active: number
    behavior_alert: number
    needs_alert: number
    no_class: number
    inactive: number
  }
}

interface BullyingFlagged {
  student_id: string
  name: string
  current_class: string
  process_id: string
  process_name: string
  signals: number
}

interface ConvivenciaOverview {
  flagged: BullyingFlagged[]
  total_signals: number
  processes_checked: number
}

const BEHAVIOR_COLORS: Record<string, string> = {
  Seguimiento: "bg-amber-100 text-amber-700",
  Conflictiva: "bg-red-100 text-red-700",
}

const NEEDS_COLORS: Record<string, string> = {
  NEE: "bg-purple-100 text-purple-700",
  ACNEAE: "bg-blue-100 text-blue-700",
  Refuerzo: "bg-cyan-100 text-cyan-700",
  "Altas capacidades": "bg-emerald-100 text-emerald-700",
  "Observación interna": "bg-slate-100 text-slate-700",
  "Sí": "bg-orange-100 text-orange-700",
}

function StudentCard({ s }: { s: StudentSummary }) {
  return (
    <Card className="hover:bg-muted/30 transition-colors">
      <CardContent className="py-3 px-4">
        <Link href={`/alumnado/${s.id}`} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{s.last_name}, {s.first_name}</p>
            <p className="text-xs text-muted-foreground">
              ID: {s.external_id ?? "—"}
              {s.current_class && ` · ${s.current_class}`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {s.behavior_level && BEHAVIOR_COLORS[s.behavior_level] && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BEHAVIOR_COLORS[s.behavior_level]}`}>
                {s.behavior_level}
              </span>
            )}
            {s.needs_type && s.needs_type !== "No" && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${NEEDS_COLORS[s.needs_type] ?? "bg-muted text-muted-foreground"}`}>
                {s.needs_type}
              </span>
            )}
            {s.active === false && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Baja</span>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </Link>
      </CardContent>
    </Card>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-10 text-muted-foreground text-sm">{label}</div>
  )
}

export default function OrientadorPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [convivencia, setConvivencia] = useState<ConvivenciaOverview | null>(null)
  const [loadingConvivencia, setLoadingConvivencia] = useState(true)

  useEffect(() => {
    fetch("/api/orientador/overview")
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setOverview(d)
      })
      .catch(() => setError("Error al cargar datos"))
      .finally(() => setLoading(false))
    fetch("/api/orientador/convivencia")
      .then(r => r.ok ? r.json() : null)
      .then(d => setConvivencia(d))
      .catch(() => null)
      .finally(() => setLoadingConvivencia(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />Cargando...
      </div>
    )
  }

  if (error || !overview) {
    return <div className="p-8 text-destructive">{error ?? "Sin datos"}</div>
  }

  const { totals } = overview

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Panel de Orientación</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vista consolidada del alumnado que requiere atención
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{totals.behavior_alert}</p>
              <p className="text-xs text-muted-foreground">Conducta</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <Heart className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{totals.needs_alert}</p>
              <p className="text-xs text-muted-foreground">Con necesidades</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{totals.no_class}</p>
              <p className="text-xs text-muted-foreground">Sin clase</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <UserX className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{totals.inactive}</p>
              <p className="text-xs text-muted-foreground">Bajas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-700">{convivencia?.flagged.length ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Alertas convivencia</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="behavior">
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="behavior">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Conducta
            {totals.behavior_alert > 0 && (
              <Badge className="ml-2 h-5 px-1.5 text-xs bg-amber-500">{totals.behavior_alert}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="needs">
            <Heart className="w-4 h-4 mr-2" />
            Necesidades
            {totals.needs_alert > 0 && (
              <Badge className="ml-2 h-5 px-1.5 text-xs bg-purple-500">{totals.needs_alert}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="noclass">
            <BookOpen className="w-4 h-4 mr-2" />
            Sin clase
            {totals.no_class > 0 && (
              <Badge className="ml-2 h-5 px-1.5 text-xs">{totals.no_class}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="inactive">
            <UserX className="w-4 h-4 mr-2" />
            Bajas
            {totals.inactive > 0 && (
              <Badge className="ml-2 h-5 px-1.5 text-xs bg-red-500">{totals.inactive}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="convivencia">
            <ShieldAlert className="w-4 h-4 mr-2" />
            Convivencia
            {(convivencia?.flagged.length ?? 0) > 0 && (
              <Badge className="ml-2 h-5 px-1.5 text-xs bg-red-600">{convivencia!.flagged.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="behavior">
          <p className="text-sm text-muted-foreground mb-4">
            Alumnos con conducta marcada como <strong>Seguimiento</strong> o <strong>Conflictiva</strong>.
          </p>
          {overview.behavior_alert.length === 0
            ? <EmptyState label="No hay alumnos con alertas de conducta" />
            : <div className="space-y-2">{overview.behavior_alert.map(s => <StudentCard key={s.id} s={s} />)}</div>
          }
        </TabsContent>

        <TabsContent value="needs">
          <p className="text-sm text-muted-foreground mb-4">
            Alumnos con necesidades educativas especiales o de apoyo registradas.
          </p>
          {overview.needs_alert.length === 0
            ? <EmptyState label="No hay alumnos con necesidades registradas" />
            : <div className="space-y-2">{overview.needs_alert.map(s => <StudentCard key={s.id} s={s} />)}</div>
          }
        </TabsContent>

        <TabsContent value="noclass">
          <p className="text-sm text-muted-foreground mb-4">
            Alumnos registrados sin clase asignada todavía.
          </p>
          {overview.no_class.length === 0
            ? <EmptyState label="Todos los alumnos tienen clase asignada" />
            : <div className="space-y-2">{overview.no_class.map(s => <StudentCard key={s.id} s={s} />)}</div>
          }
        </TabsContent>

        <TabsContent value="inactive">
          <p className="text-sm text-muted-foreground mb-4">
            Alumnos dados de baja. Sus datos están conservados.
          </p>
          {overview.inactive.length === 0
            ? <EmptyState label="No hay alumnos de baja" />
            : <div className="space-y-2">{overview.inactive.map(s => <StudentCard key={s.id} s={s} />)}</div>
          }
        </TabsContent>

        <TabsContent value="convivencia">
          <p className="text-sm text-muted-foreground mb-4">
            Alumnos con señales de riesgo en el módulo de convivencia/acoso de los cuestionarios activos.
            Acceso restringido. Toda consulta queda registrada.
          </p>
          {loadingConvivencia ? (
            <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
            </div>
          ) : !convivencia || convivencia.flagged.length === 0 ? (
            <EmptyState label="Sin alumnos con señales de riesgo en convivencia detectadas" />
          ) : (
            <div className="space-y-2">
              {convivencia.flagged.map(s => (
                <Card key={`${s.process_id}:${s.student_id}`} className="hover:bg-muted/30 transition-colors border-red-100">
                  <CardContent className="py-3 px-4">
                    <Link
                      href={`/processes/${s.process_id}/students/${s.student_id}/intervention`}
                      className="flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <ShieldAlert className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.current_class && `${s.current_class} · `}{s.process_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-red-700 border-red-300 text-xs font-bold">
                          {s.signals} señales
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              ))}
              <p className="text-xs text-muted-foreground mt-2">
                Total de {convivencia.total_signals} respuestas analizadas en {convivencia.processes_checked} procesos activos.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
