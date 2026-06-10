"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface UserActionsProps {
  userId: string
  currentRole: string
  currentUserRole: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  tutor: "Tutor",
  orientador: "Orientador",
}

export default function UserActions({ userId, currentRole, currentUserRole }: UserActionsProps) {
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState(currentRole)
  const router = useRouter()

  const canEdit = ["admin", "superadmin"].includes(currentUserRole)

  async function handleRoleChange(newRole: string) {
    setSaving(true)
    setRole(newRole)
    await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    })
    setSaving(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm("¿Seguro que quieres eliminar este usuario? Esta acción no se puede deshacer.")) return
    setSaving(true)
    await fetch(`/api/users/${userId}`, { method: "DELETE" })
    setSaving(false)
    router.refresh()
  }

  if (!canEdit) {
    return <span className="text-sm text-muted-foreground">{ROLE_LABELS[role] ?? role}</span>
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        onChange={e => handleRoleChange(e.target.value)}
        disabled={saving}
        className="text-sm border rounded px-2 py-1 bg-background"
      >
        {Object.entries(ROLE_LABELS).map(([val, label]) => (
          <option key={val} value={val}>{label}</option>
        ))}
      </select>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive text-xs"
        onClick={handleDelete}
        disabled={saving}
      >
        Eliminar
      </Button>
    </div>
  )
}
