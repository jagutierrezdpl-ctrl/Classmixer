"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, UserPlus } from "lucide-react"

interface TutorUser {
  id: string
  name: string
  email: string
  role: string
}

interface Assignment {
  id: string
  user_id: string
  users: TutorUser
}

interface CenterUser {
  id: string
  name: string
  email: string
  role: string
}

interface ProcessTeamProps {
  processId: string
  isAdmin: boolean
}

const ROLE_LABEL: Record<string, string> = {
  tutor: "Tutor",
  orientador: "Orientador",
  admin: "Admin",
}

export default function ProcessTeam({ processId, isAdmin }: ProcessTeamProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [centerUsers, setCenterUsers] = useState<CenterUser[]>([])
  const [showSelect, setShowSelect] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/processes/${processId}/tutors`)
    if (res.ok) setAssignments(await res.json())
  }, [processId])

  useEffect(() => { load() }, [load])

  async function loadCenterUsers() {
    if (centerUsers.length > 0) return
    const res = await fetch("/api/users")
    if (res.ok) setCenterUsers(await res.json())
  }

  async function handleAdd(userId: string) {
    setSaving(true)
    await fetch(`/api/processes/${processId}/tutors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    })
    setSaving(false)
    setShowSelect(false)
    load()
  }

  async function handleRemove(userId: string) {
    setSaving(true)
    await fetch(`/api/processes/${processId}/tutors/${userId}`, { method: "DELETE" })
    setSaving(false)
    load()
  }

  const assignedIds = new Set(assignments.map(a => a.user_id))
  const available = centerUsers.filter(u => !assignedIds.has(u.id) && u.role !== "alumno")

  return (
    <div className="space-y-2">
      {assignments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin tutores asignados.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {assignments.map(a => (
            <div key={a.id} className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1">
              <span className="text-xs font-medium">{a.users.name}</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                {ROLE_LABEL[a.users.role] ?? a.users.role}
              </Badge>
              {isAdmin && (
                <button
                  onClick={() => handleRemove(a.user_id)}
                  disabled={saving}
                  className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        showSelect ? (
          <div className="flex items-center gap-2">
            <select
              className="text-sm border rounded-md px-2 py-1.5 bg-background flex-1 max-w-xs"
              defaultValue=""
              onChange={e => e.target.value && handleAdd(e.target.value)}
            >
              <option value="" disabled>Seleccionar usuario...</option>
              {available.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({ROLE_LABEL[u.role] ?? u.role})
                </option>
              ))}
              {available.length === 0 && (
                <option disabled>Sin usuarios disponibles</option>
              )}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSelect(false)}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={() => { setShowSelect(true); loadCenterUsers() }}
          >
            <UserPlus className="w-3 h-3" />
            Añadir miembro
          </Button>
        )
      )}
    </div>
  )
}
