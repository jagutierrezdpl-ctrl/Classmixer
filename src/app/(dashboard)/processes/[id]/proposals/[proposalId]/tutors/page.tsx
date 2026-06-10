"use client"

import { use, useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, GraduationCap, AlertTriangle, CheckCircle2, Users } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface CenterUser {
  id: string
  name: string
  email: string
  role: string
}

interface TutorAssignment {
  target_class: string
  user_id: string | null
  users?: { id: string; name: string; email: string }
  conflicts?: string[]
}

export default function TutorsPage({
  params,
}: {
  params: Promise<{ id: string; proposalId: string }>
}) {
  const { id: processId, proposalId } = use(params)

  const [loading, setLoading] = useState(true)
  const [targetClasses, setTargetClasses] = useState<string[]>([])
  const [users, setUsers] = useState<CenterUser[]>([])
  const [tutorMap, setTutorMap] = useState<Record<string, TutorAssignment>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [proposalName, setProposalName] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [procRes, propRes, tutorsRes, usersRes] = await Promise.all([
        fetch(`/api/processes/${processId}`),
        fetch(`/api/proposals/${proposalId}`),
        fetch(`/api/proposals/${proposalId}/tutors`),
        fetch(`/api/users`),
      ])

      if (!procRes.ok || !propRes.ok) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const proc = await procRes.json() as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prop = await propRes.json() as any
      const tutors = tutorsRes.ok ? await tutorsRes.json() : []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const usersData = usersRes.ok ? (await usersRes.json()) as any[] : []

      setTargetClasses((proc.target_groups as string[]) ?? [])
      setProposalName(prop.name ?? "Propuesta")
      setUsers(usersData)

      const map: Record<string, TutorAssignment> = {}
      for (const cls of (proc.target_groups as string[]) ?? []) {
        const existing = tutors.find((t: TutorAssignment) => t.target_class === cls)
        map[cls] = existing ?? { target_class: cls, user_id: null }
      }
      setTutorMap(map)
    } finally {
      setLoading(false)
    }
  }, [processId, proposalId])

  useEffect(() => { load() }, [load])

  async function assignTutor(targetClass: string, userId: string | null) {
    setSaving(targetClass)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/tutors`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_class: targetClass, user_id: userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Error al asignar tutor")
        return
      }
      setTutorMap(prev => ({
        ...prev,
        [targetClass]: { ...data, target_class: targetClass },
      }))
      if (data.conflicts?.length > 0) {
        toast.warning(`Tutor asignado con ${data.conflicts.length} conflicto(s)`, {
          description: data.conflicts.join("\n"),
        })
      } else {
        toast.success(`Tutor asignado a ${targetClass}`)
      }
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/processes/${processId}/proposals`}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Asignación de tutores</h1>
          <p className="text-muted-foreground text-sm">{proposalName}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Asigna un tutor a cada clase destino de esta propuesta. Si existe alguna restricción entre un alumno y el tutor asignado, aparecerá una alerta.
      </p>

      {users.length === 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">No hay profesores disponibles</p>
            <p className="text-sm text-amber-700 mt-1">
              No se han encontrado usuarios con rol de tutor en el centro. Gestiona los usuarios desde{" "}
              <Link href="/users" className="underline">Usuarios del centro</Link>.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {targetClasses.map(cls => {
          const assignment = tutorMap[cls]
          const hasConflicts = (assignment?.conflicts?.length ?? 0) > 0
          const hasTutor = !!assignment?.user_id

          return (
            <Card key={cls} className={hasConflicts ? "border-amber-300" : hasTutor ? "border-green-300" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <GraduationCap className="w-4 h-4 text-primary" />
                    </div>
                    <CardTitle className="text-base">Clase {cls}</CardTitle>
                    {hasTutor && !hasConflicts && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    {hasConflicts && (
                      <Badge variant="warning" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {assignment.conflicts!.length} conflicto(s)
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                  <select
                    className="flex-1 text-sm border rounded-md px-3 py-1.5 bg-background"
                    value={assignment?.user_id ?? ""}
                    onChange={e => assignTutor(cls, e.target.value || null)}
                    disabled={saving === cls}
                  >
                    <option value="">— Sin tutor asignado —</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role === "tutor" ? "Tutor" : u.role === "orientador" ? "Orientador" : u.role})
                      </option>
                    ))}
                  </select>
                  {saving === cls && (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                {assignment?.users && (
                  <div className="text-xs text-muted-foreground pl-7">
                    {assignment.users.name} · {assignment.users.email}
                  </div>
                )}

                {hasConflicts && (
                  <div className="pl-7 space-y-1">
                    {assignment.conflicts!.map((c, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-1">
                      Puedes asignar este tutor, pero revisa las restricciones antes de confirmar.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mt-8 pt-4 border-t">
        <p className="text-xs text-muted-foreground">
          Para añadir restricciones alumno-tutor, ve a{" "}
          <Link href={`/processes/${processId}/rules`} className="underline">Reglas del proceso</Link>{" "}
          y crea una regla de tipo &quot;Evitar tutor&quot;.
        </p>
      </div>
    </div>
  )
}
