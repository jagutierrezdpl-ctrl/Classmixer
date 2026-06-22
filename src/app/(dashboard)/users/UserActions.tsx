"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Loader2, UserCheck, UserX, Trash2 } from "lucide-react"
import { useConfirm } from "@/components/ui/ConfirmDialog"

interface UserActionsProps {
  userId: string
  currentRole: string
  isActive: boolean
  currentUserRole: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  tutor: "Tutor",
  orientador: "Orientador",
}

export default function UserActions({ userId, currentRole, isActive, currentUserRole }: UserActionsProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const confirmFn = useConfirm()

  const canEdit = ["admin", "superadmin"].includes(currentUserRole)
  if (!canEdit) {
    return <span className="text-sm text-muted-foreground">{ROLE_LABELS[currentRole] ?? currentRole}</span>
  }

  async function patch(data: Record<string, unknown>) {
    setLoading(true)
    await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    setLoading(false)
    router.refresh()
  }

  async function handleDelete() {
    const ok = await confirmFn({ title: "Eliminar usuario", description: "¿Seguro que quieres eliminar este usuario? No se puede deshacer.", confirmLabel: "Eliminar", variant: "destructive" })
    if (!ok) return
    setLoading(true)
    await fetch(`/api/users/${userId}`, { method: "DELETE" })
    setLoading(false)
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0" disabled={loading}>
          {loading
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <ChevronDown className="w-3 h-3" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-xs w-44">
        {/* Role options */}
        {isActive && Object.entries(ROLE_LABELS).map(([val, label]) => (
          <DropdownMenuItem
            key={val}
            className={`gap-2 text-xs ${currentRole === val ? "font-semibold" : ""}`}
            onClick={() => patch({ role: val })}
            disabled={currentRole === val}
          >
            {label}
            {currentRole === val && <span className="ml-auto text-muted-foreground">✓</span>}
          </DropdownMenuItem>
        ))}

        {isActive && <DropdownMenuSeparator />}

        {/* Toggle active */}
        {isActive ? (
          <DropdownMenuItem
            className="gap-2 text-xs text-orange-600 focus:text-orange-600"
            onClick={() => patch({ active: false })}
          >
            <UserX className="w-3.5 h-3.5" /> Desactivar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="gap-2 text-xs text-green-700 focus:text-green-700"
            onClick={() => patch({ active: true })}
          >
            <UserCheck className="w-3.5 h-3.5" /> Activar
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="gap-2 text-xs text-destructive focus:text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="w-3.5 h-3.5" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
