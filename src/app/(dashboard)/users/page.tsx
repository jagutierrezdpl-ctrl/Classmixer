import { createServiceClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import UserActions from "./UserActions"
import InviteDialog from "./InviteDialog"
import RescueDialog from "./RescueDialog"

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  tutor: "Tutor",
  orientador: "Orientador",
  pending: "Sin configurar",
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })
}

export default async function UsersPage() {
  const profile = await requireRole(["admin", "superadmin"])
  const supabase = createServiceClient()

  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, role, active, created_at")
    .eq("center_id", profile.center_id)
    .order("active", { ascending: false })
    .order("created_at", { ascending: true })

  const activeCount = (users ?? []).filter(u => u.active !== false).length
  const inactiveCount = (users ?? []).filter(u => u.active === false).length

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Usuarios</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeCount} activo{activeCount !== 1 ? "s" : ""}
              {inactiveCount > 0 && ` · ${inactiveCount} desactivado${inactiveCount !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RescueDialog />
          <InviteDialog />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Miembros del equipo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(users ?? []).length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">
              No hay usuarios registrados.
            </p>
          ) : (
            <div className="divide-y">
              {(users ?? []).map(u => {
                const isMe = u.id === profile.id
                const isActive = u.active !== false
                return (
                  <div key={u.id} className={`flex items-center gap-3 px-4 py-3 ${!isActive ? "opacity-60" : ""}`}>
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isActive ? "bg-primary/10" : "bg-muted"}`}>
                      <span className={`text-sm font-semibold ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                        {(u.name ?? u.email ?? "?").charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>

                    {/* Role badge */}
                    <span className="text-xs text-muted-foreground hidden sm:block shrink-0">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>

                    {/* Status badge */}
                    {isMe ? (
                      <Badge variant="secondary" className="text-xs shrink-0">Tú</Badge>
                    ) : isActive ? (
                      <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50 shrink-0">Activo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-gray-500 border-gray-300 shrink-0">Desactivado</Badge>
                    )}

                    {/* Date */}
                    <span className="text-xs text-muted-foreground hidden md:block shrink-0">
                      {formatDate(u.created_at)}
                    </span>

                    {/* Actions */}
                    {!isMe && (
                      <UserActions
                        userId={u.id}
                        currentRole={u.role}
                        isActive={isActive}
                        currentUserRole={profile.role}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-4">
        Si un usuario entró con Google antes de ser dado de alta, usa &ldquo;Activar cuenta pendiente&rdquo;.
      </p>
    </div>
  )
}
