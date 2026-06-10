"use client"

import { useState, useEffect, use } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft, User, BookOpen, Network,
  GraduationCap, TrendingUp, AlertTriangle,
  CheckCircle2, Loader2, Calendar
} from "lucide-react"
import Link from "next/link"

interface StudentProfile {
  id: string
  external_id: string
  first_name: string
  last_name: string
  birth_year: number | null
  created_at: string
}

interface SociogramMetric {
  received_count: number
  given_count: number
  reciprocal_count: number
  centrality: number | null
  isolation_score: number | null
  community_id: number | null
}

interface TrajectoryEntry {
  student: {
    id: string
    current_class: string
    gender: string
    average_grade: number | null
    academic_level: string | null
    behavior_level: string | null
    needs_type: string | null
    observations: string | null
    created_at: string
  }
  process: {
    id: string
    name: string
    school_year: string
    process_type: string
    status: string
    source_level: string
    target_level: string | null
  }
  sociogram: SociogramMetric | null
  final_assignment: {
    target_class: string
    proposals: { name: string; status: string }
  } | null
}

const ACADEMIC_COLORS: Record<string, string> = {
  Alto: "bg-green-100 text-green-700",
  "Medio-alto": "bg-lime-100 text-lime-700",
  Medio: "bg-yellow-100 text-yellow-700",
  "Medio-bajo": "bg-orange-100 text-orange-700",
  Bajo: "bg-red-100 text-red-700",
}

const BEHAVIOR_COLORS: Record<string, string> = {
  Positiva: "bg-green-100 text-green-700",
  Normal: "bg-slate-100 text-slate-700",
  Seguimiento: "bg-amber-100 text-amber-700",
  Conflictiva: "bg-red-100 text-red-700",
}

export default function AlumnoTrajectoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<{ profile: StudentProfile; trajectory: TrajectoryEntry[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/student-profiles/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError("Error al cargar los datos"))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Cargando trayectoria...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <p className="text-destructive">{error ?? "No encontrado"}</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/alumnado"><ArrowLeft className="w-4 h-4 mr-2" />Volver</Link>
        </Button>
      </div>
    )
  }

  const { profile, trajectory } = data

  // Summary stats across all entries
  const avgGrades = trajectory
    .map(e => e.student.average_grade)
    .filter((g): g is number => g !== null)
  const latestGrade = avgGrades[avgGrades.length - 1]
  const firstGrade = avgGrades[0]
  const gradeTrend = avgGrades.length >= 2 ? latestGrade - firstGrade : null

  const isolatedCount = trajectory.filter(
    e => e.sociogram && e.sociogram.received_count === 0
  ).length

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/alumnado"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {profile.first_name} {profile.last_name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">ID: {profile.external_id}</span>
              {profile.birth_year && (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="w-3 h-3 mr-1" />{profile.birth_year}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {trajectory.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <BookOpen className="w-3 h-3" />Procesos
              </div>
              <p className="text-2xl font-bold">{trajectory.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <GraduationCap className="w-3 h-3" />Nota actual
              </div>
              <p className="text-2xl font-bold">{latestGrade?.toFixed(1) ?? "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <TrendingUp className="w-3 h-3" />Tendencia
              </div>
              <p className={`text-2xl font-bold ${gradeTrend === null ? "" : gradeTrend >= 0 ? "text-green-600" : "text-red-600"}`}>
                {gradeTrend === null ? "—" : `${gradeTrend >= 0 ? "+" : ""}${gradeTrend.toFixed(1)}`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <AlertTriangle className="w-3 h-3" />Veces aislado
              </div>
              <p className={`text-2xl font-bold ${isolatedCount > 0 ? "text-amber-600" : ""}`}>
                {isolatedCount}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trajectory timeline */}
      <h2 className="text-lg font-semibold mb-4">Trayectoria escolar</h2>

      {trajectory.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          Este alumno no aparece en ningún proceso todavía
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            {trajectory.map((entry, idx) => (
              <div key={entry.student.id} className="relative flex gap-6">
                {/* Timeline dot */}
                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                  idx === trajectory.length - 1
                    ? "bg-primary border-primary text-white"
                    : "bg-background border-border text-muted-foreground"
                }`}>
                  <span className="text-xs font-bold">{trajectory.length - idx}</span>
                </div>

                <Card className="flex-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">
                          <Link
                            href={`/processes/${entry.process.id}`}
                            className="hover:underline"
                          >
                            {entry.process.name}
                          </Link>
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {entry.process.school_year}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {entry.process.source_level}
                          </Badge>
                          <Badge
                            variant={entry.process.process_type === "sociograma" ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {entry.process.process_type === "sociograma" ? (
                              <><Network className="w-3 h-3 mr-1" />Sociograma</>
                            ) : (
                              <><GraduationCap className="w-3 h-3 mr-1" />Mezcla</>
                            )}
                          </Badge>
                        </div>
                      </div>
                      {entry.final_assignment && (
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">Clase asignada</p>
                          <p className="font-bold text-lg">{entry.final_assignment.target_class}</p>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {/* Academic data */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Clase origen</p>
                        <p className="font-medium">{entry.student.current_class}</p>
                      </div>

                      {entry.student.average_grade !== null && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Nota media</p>
                          <p className="font-medium">{entry.student.average_grade.toFixed(1)}</p>
                        </div>
                      )}

                      {entry.student.academic_level && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Nivel</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            ACADEMIC_COLORS[entry.student.academic_level] ?? "bg-muted"
                          }`}>
                            {entry.student.academic_level}
                          </span>
                        </div>
                      )}

                      {entry.student.behavior_level && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Conducta</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            BEHAVIOR_COLORS[entry.student.behavior_level] ?? "bg-muted"
                          }`}>
                            {entry.student.behavior_level}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Sociogram data */}
                    {entry.sociogram && (
                      <div className="mt-4 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Network className="w-3 h-3" />Sociograma
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-center">
                            <p className="font-bold text-lg">{entry.sociogram.received_count}</p>
                            <p className="text-xs text-muted-foreground">Elegido</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-lg">{entry.sociogram.given_count}</p>
                            <p className="text-xs text-muted-foreground">Elige a</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-lg">{entry.sociogram.reciprocal_count}</p>
                            <p className="text-xs text-muted-foreground">Recíprocas</p>
                          </div>
                          {entry.sociogram.received_count === 0 && (
                            <Badge variant="destructive" className="text-xs ml-2">
                              <AlertTriangle className="w-3 h-3 mr-1" />Aislado
                            </Badge>
                          )}
                          {entry.sociogram.received_count > 0 && entry.sociogram.reciprocal_count === 0 && (
                            <Badge className="text-xs ml-2 bg-amber-100 text-amber-700 border-0">
                              Sin recíproca
                            </Badge>
                          )}
                          {entry.sociogram.received_count >= 4 && (
                            <Badge className="text-xs ml-2 bg-blue-100 text-blue-700 border-0">
                              <CheckCircle2 className="w-3 h-3 mr-1" />Líder social
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Observations */}
                    {entry.student.observations && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Observaciones</p>
                        <p className="text-sm italic text-muted-foreground">{entry.student.observations}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
