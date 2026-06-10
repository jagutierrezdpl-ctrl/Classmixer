import { createServiceClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import UserActions from "./UserActions"

const ROLE_BADGES: Record<string, "default" | "secondary" | "outline" | "warning"> = {
  superadmin: "default",
  admin: "default",
  tutor: "secondary",
  orientador: "secondary",
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
    .select("id, name, email, role, created_at")
    .eq("center_id", profile.center_id)
    .order("created_at", { ascending: true })

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {(users ?? []).length} usuario{(users ?? []).length !== 1 ? "s" : ""} en el centro
          </p>
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
              {(users ?? []).map(u => (
                <div key={u.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {(u.name ?? u.email ?? "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {formatDate(u.created_at)}
                    </span>
                    {u.id === profile.id ? (
                      <Badge variant={ROLE_BADGES[u.role] ?? "secondary"} className="text-xs">
                        {u.role} (tú)
                      </Badge>
                    ) : (
                      <UserActions
                        userId={u.id}
                        currentRole={u.role}
                        currentUserRole={profile.role}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-4">
        Los usuarios se registran al iniciar sesión por primera vez con su cuenta institucional.
        Desde aquí puedes cambiar su rol o eliminarlos del sistema.
      </p>
    </div>
  )
}
