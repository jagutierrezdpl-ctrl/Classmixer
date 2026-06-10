"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, User, ChevronRight, Loader2, AlertTriangle, Download } from "lucide-react"
import Link from "next/link"

interface GroupSummary {
  name: string
  count: number
  female: number
  male: number
  with_needs: number
  tutor: { id: string; name: string; email: string } | null
}

export default function MisGruposPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [groupsRes, profileRes] = await Promise.all([
          fetch("/api/student-profiles/groups"),
          fetch("/api/auth/me").catch(() => null),
        ])
        const allGroups = await groupsRes.json()
        const meData = profileRes ? await profileRes.json() : null
        const userId = meData?.id ?? null
        setMyUserId(userId)
        // Filter to only groups where I'm the tutor
        const mine = (Array.isArray(allGroups) ? allGroups : []).filter(
          (g: GroupSummary) => userId && g.tutor?.id === userId
        )
        setGroups(mine)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />Cargando...
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Mis Grupos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Clases asignadas a tu tutoría
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No tienes grupos asignados todavía</p>
          <p className="text-sm mt-1">El administrador del centro debe asignarte como tutor/a de una clase</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map(g => (
            <Card key={g.name} className="hover:bg-muted/30 transition-colors">
              <CardContent className="py-5 px-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-bold">{g.name}</h2>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />{g.count} alumnos
                      </span>
                      {g.female > 0 && <span className="text-pink-600">{g.female}F</span>}
                      {g.male > 0 && <span className="text-blue-600">{g.male}M</span>}
                      {g.with_needs > 0 && (
                        <span className="text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />{g.with_needs}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-0">Mi grupo</Badge>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/alumnado/grupos/${encodeURIComponent(g.name)}`}>
                      <User className="w-4 h-4 mr-2" />Ver alumnos
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/student-profiles/export-template?group=${encodeURIComponent(g.name)}`} download>
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
