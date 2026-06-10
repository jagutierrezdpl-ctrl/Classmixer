"use client"

import { useState, useEffect, use, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
  ArrowLeft, Users, User, ChevronRight, Loader2,
  Download, AlertTriangle, UserCog, CheckCircle2
} from "lucide-react"
import Link from "next/link"

interface Student {
  id: string
  first_name: string
  last_name: string
  gender: string | null
  academic_level: string | null
  behavior_level: string | null
  needs_type: string | null
  birth_year: number | null
  external_id: string | null
}

interface TutorAssignment {
  id: string
  school_year: string
  user_id: string
  users: { id: string; name: string; email: string }
}

interface UserOption {
  id: string
  name: string
  email: string
  role: string
}

const ACADEMIC_COLORS: Record<string, string> = {
  Alto: "bg-green-100 text-green-700",
  "Medio-alto": "bg-lime-100 text-lime-700",
  Medio: "bg-yellow-100 text-yellow-700",
  "Medio-bajo": "bg-orange-100 text-orange-700",
  Bajo: "bg-red-100 text-red-700",
}

export default function GroupDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params)
  const groupName = decodeURIComponent(name)

  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [tutors, setTutors] = useState<TutorAssignment[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [savingTutor, setSavingTutor] = useState(false)
  const [tutorSuccess, setTutorSuccess] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [schoolYear, setSchoolYear] = useState(() => {
    const now = new Date()
    const y = now.getFullYear()
    return now.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`
  })

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/student-profiles?class=${encodeURIComponent(groupName)}&page=1`)
      const data = await res.json()
      setStudents(data.profiles ?? [])
    } finally {
      setLoading(false)
    }
  }, [groupName])

  const loadTutors = useCallback(async () => {
    const res = await fetch(`/api/groups/${encodeURIComponent(groupName)}/tutor`)
    const data = await res.json()
    setTutors(Array.isArray(data) ? data : [])
    const current = Array.isArray(data)
      ? data.find((t: TutorAssignment) => t.school_year === schoolYear)
      : null
    if (current) setSelectedUserId(current.user_id)
  }, [groupName, schoolYear])

  useEffect(() => {
    loadStudents()
    fetch("/api/users").then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : []))
  }, [loadStudents])

  useEffect(() => { loadTutors() }, [loadTutors])

  async function handleAssignTutor() {
    if (!selectedUserId) return
    setSavingTutor(true)
    setTutorSuccess(false)
    try {
      await fetch(`/api/groups/${encodeURIComponent(groupName)}/tutor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedUserId, school_year: schoolYear }),
      })
      await loadTutors()
      setTutorSuccess(true)
      setTimeout(() => setTutorSuccess(false), 3000)
    } finally {
      setSavingTutor(false)
    }
  }

  async function handleRemoveTutor() {
    await fetch(`/api/groups/${encodeURIComponent(groupName)}/tutor?school_year=${schoolYear}`, {
      method: "DELETE",
    })
    setSelectedUserId("")
    loadTutors()
  }

  const currentTutor = tutors.find(t => t.school_year === schoolYear)
  const female = students.filter(s => s.gender === "F").length
  const male = students.filter(s => s.gender === "M").length
  const withNeeds = students.filter(s => s.needs_type && s.needs_type !== "No").length

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/alumnado"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Grupo {groupName}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Detalle del grupo y gestión de tutoría
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{students.length}</p>
              <p className="text-xs text-muted-foreground">Alumnos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex gap-4 text-sm">
              <div><span className="font-bold text-pink-600 text-xl">{female}</span><br /><span className="text-xs text-muted-foreground">Alumnas</span></div>
              <div><span className="font-bold text-blue-600 text-xl">{male}</span><br /><span className="text-xs text-muted-foreground">Alumnos</span></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{withNeeds}</p>
              <p className="text-xs text-muted-foreground">Con necesidades</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tutor assignment */}
      <Card className="mb-8">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="w-4 h-4" />Tutor/a asignado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentTutor && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">{currentTutor.users.name}</p>
                <p className="text-xs text-muted-foreground">{currentTutor.users.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{currentTutor.school_year}</Badge>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleRemoveTutor}>
                  Quitar
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Select value={schoolYear} onValueChange={setSchoolYear}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 3 }, (_, i) => {
                  const now = new Date()
                  const y = now.getFullYear()
                  const base = now.getMonth() >= 8 ? y : y - 1
                  return `${base - 1 + i}/${base + i}`
                }).map(sy => (
                  <SelectItem key={sy} value={sy}>{sy}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Seleccionar tutor/a..." />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter(u => ["admin", "tutor", "orientador"].includes(u.role))
                  .map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>

            <Button onClick={handleAssignTutor} disabled={!selectedUserId || savingTutor}>
              {savingTutor
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : tutorSuccess
                  ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                  : "Asignar"
              }
            </Button>
          </div>

          {tutors.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Historial de tutores</p>
              <div className="flex flex-wrap gap-2">
                {tutors.map(t => (
                  <Badge key={t.id} variant="outline" className="text-xs">
                    {t.school_year}: {t.users.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/student-profiles/export-template?group=${encodeURIComponent(groupName)}`} download>
            <Download className="w-4 h-4 mr-2" />Exportar plantilla del grupo
          </a>
        </Button>
      </div>

      {/* Students list */}
      <h2 className="text-lg font-semibold mb-4">Alumnos del grupo</h2>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />Cargando...
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No hay alumnos en este grupo</div>
      ) : (
        <div className="space-y-2">
          {students.map(s => (
            <Card key={s.id} className="hover:bg-muted/30 transition-colors">
              <CardContent className="py-3 px-4">
                <Link href={`/alumnado/${s.id}`} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{s.last_name}, {s.first_name}</p>
                    <p className="text-xs text-muted-foreground">ID: {s.external_id ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.gender && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.gender === "F" ? "bg-pink-100 text-pink-700"
                          : s.gender === "M" ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      }`}>{s.gender}</span>
                    )}
                    {s.academic_level && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        ACADEMIC_COLORS[s.academic_level] ?? "bg-muted"
                      }`}>{s.academic_level}</span>
                    )}
                    {s.needs_type && s.needs_type !== "No" && (
                      <Badge className="text-xs bg-amber-100 text-amber-700 border-0">{s.needs_type}</Badge>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
