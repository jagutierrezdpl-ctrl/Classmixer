"use client"

import { use, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2, Heart, Briefcase, Printer, Users, UserX, UserCheck, HandHeart, ThumbsDown } from "lucide-react"
import Link from "next/link"

interface FriendEntry {
  id: string
  first_name: string
  last_name: string
  target_class: string | null
  same_class: boolean
}

interface StudentRow {
  student_id: string
  first_name: string
  last_name: string
  current_class: string
  gender: string
  target_class: string
  friendship_choices: FriendEntry[]
  work_choices: FriendEntry[]
  emotional_choices: FriendEntry[]
  negative_choices: FriendEntry[]
  has_friend_in_class: boolean
  answered_questionnaire: boolean
}

type Filter = "todos" | "con_amigo" | "sin_amigo" | "sin_respuesta"

const FILTER_LABELS: Record<Filter, string> = {
  todos: "Todos",
  con_amigo: "Con amigo en clase",
  sin_amigo: "Sin amigos en clase",
  sin_respuesta: "Sin respuesta",
}

export default function FriendsPage({
  params,
}: {
  params: Promise<{ id: string; proposalId: string }>
}) {
  const { id, proposalId } = use(params)
  const [data, setData] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("todos")
  const [classFilter, setClassFilter] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/proposals/${proposalId}/friends`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setData(d) })
      .finally(() => setLoading(false))
  }, [proposalId])

  const classes = [...new Set(data.map(s => s.target_class))].sort()

  const visible = data.filter(s => {
    if (classFilter && s.target_class !== classFilter) return false
    if (filter === "con_amigo") return s.has_friend_in_class
    if (filter === "sin_amigo") return s.answered_questionnaire && !s.has_friend_in_class
    if (filter === "sin_respuesta") return !s.answered_questionnaire
    return true
  })

  const withFriend = data.filter(s => s.answered_questionnaire && s.has_friend_in_class).length
  const withoutFriend = data.filter(s => s.answered_questionnaire && !s.has_friend_in_class).length
  const noResponse = data.filter(s => !s.answered_questionnaire).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl print:p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/processes/${id}/proposals`}><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Vínculos en la propuesta</h1>
            <p className="text-sm text-muted-foreground">Qué alumnos coinciden con sus amigos elegidos</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
          <Printer className="w-4 h-4" /> Imprimir
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{withFriend}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Con amigo en clase</p>
        </div>
        <div className="rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{withoutFriend}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Sin amigos en clase</p>
        </div>
        <div className="rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-muted-foreground">{noResponse}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Sin respuesta</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 print:hidden">
        {(Object.keys(FILTER_LABELS) as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground border-border hover:bg-muted/50"
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
        <div className="w-px bg-border mx-1" />
        {classes.map(cls => (
          <button
            key={cls}
            onClick={() => setClassFilter(classFilter === cls ? null : cls)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              classFilter === cls
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground border-border hover:bg-muted/50"
            }`}
          >
            {cls}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mb-4 print:hidden">
        {visible.length} alumno{visible.length !== 1 ? "s" : ""} mostrados
      </p>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Alumno</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-20">Origen</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-20">Nueva</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-pink-400" /> Amistad</span>
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3 text-blue-400" /> Trabajo</span>
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                <span className="flex items-center gap-1"><HandHeart className="w-3 h-3 text-purple-400" /> Apoyo emocional</span>
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                <span className="flex items-center gap-1"><ThumbsDown className="w-3 h-3 text-red-400" /> Rechazo</span>
              </th>
              <th className="px-4 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                  No hay alumnos con este filtro
                </td>
              </tr>
            )}
            {visible.map(s => (
              <tr key={s.student_id} className={`hover:bg-muted/20 ${!s.answered_questionnaire ? "opacity-50" : ""}`}>
                <td className="px-4 py-2.5">
                  <span className="font-medium">{s.last_name}, {s.first_name}</span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{s.current_class}</td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className="text-xs">{s.target_class}</Badge>
                </td>
                <td className="px-4 py-2.5">
                  {!s.answered_questionnaire ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : s.friendship_choices.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No eligió</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {s.friendship_choices.map(f => (
                        <span
                          key={f.id}
                          className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border ${
                            f.same_class
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {f.same_class ? "✓" : "·"} {f.first_name} {f.last_name}
                          {!f.same_class && f.target_class && (
                            <span className="opacity-60 text-[10px]">→{f.target_class}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {s.work_choices.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {s.work_choices.map(f => (
                        <span
                          key={f.id}
                          className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border ${
                            f.same_class
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {f.same_class ? "✓" : "·"} {f.first_name} {f.last_name}
                          {!f.same_class && f.target_class && (
                            <span className="opacity-60 text-[10px]">→{f.target_class}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {s.emotional_choices.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {s.emotional_choices.map(f => (
                        <span
                          key={f.id}
                          className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border ${
                            f.same_class
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {f.same_class ? "✓" : "·"} {f.first_name} {f.last_name}
                          {!f.same_class && f.target_class && (
                            <span className="opacity-60 text-[10px]">→{f.target_class}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {s.negative_choices.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {s.negative_choices.map(f => (
                        <span
                          key={f.id}
                          className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border ${
                            f.same_class
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {f.same_class ? "!" : "·"} {f.first_name} {f.last_name}
                          {!f.same_class && f.target_class && (
                            <span className="opacity-60 text-[10px]">→{f.target_class}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {!s.answered_questionnaire ? (
                    <span title="Sin respuesta"><Users className="w-3.5 h-3.5 text-muted-foreground mx-auto" /></span>
                  ) : s.has_friend_in_class ? (
                    <span title="Tiene amigo en clase"><UserCheck className="w-3.5 h-3.5 text-green-600 mx-auto" /></span>
                  ) : (
                    <span title="Sin amigos en clase"><UserX className="w-3.5 h-3.5 text-red-500 mx-auto" /></span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground mt-4 print:hidden">
        Verde = amistad en la misma clase · Azul = trabajo en la misma clase · Morado = apoyo emocional en la misma clase · Rojo = rechazo en la misma clase · Gris = en clase diferente
      </p>
    </div>
  )
}
