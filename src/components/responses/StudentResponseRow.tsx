"use client"

import { useState } from "react"
import { CheckCircle2, Clock, AlertCircle, ChevronDown, Heart, Briefcase, UsersRound, XCircle } from "lucide-react"

type RelationType = "friendship" | "work" | "emotional" | "negative"

const RELATION_META: Record<RelationType, { label: string; color: string; icon: React.ElementType }> = {
  friendship: { label: "Amistad",   color: "bg-pink-100 text-pink-700",     icon: Heart },
  work:       { label: "Trabajo",   color: "bg-blue-100 text-blue-700",     icon: Briefcase },
  emotional:  { label: "Apoyo",     color: "bg-purple-100 text-purple-700", icon: UsersRound },
  negative:   { label: "Conflicto", color: "bg-red-100 text-red-700",       icon: XCircle },
}

interface Props {
  student: { id: string; first_name: string; last_name: string; current_class: string }
  token: { student_id: string; used: boolean; completed_at?: string | null } | null
  responses: { relation_type: string; target_student_id: string }[]
  studentMap: Record<string, string>
}

export default function StudentResponseRow({ student, token, responses, studentMap }: Props) {
  const relationMeta = RELATION_META
  const [open, setOpen] = useState(false)

  const byType = responses.reduce<Record<string, string[]>>((acc, r) => {
    if (!acc[r.relation_type]) acc[r.relation_type] = []
    acc[r.relation_type].push(r.target_student_id)
    return acc
  }, {})

  let statusIcon = <AlertCircle className="w-4 h-4 text-amber-400" />
  let statusText = "Sin enlace"
  let statusClass = "text-amber-600"

  if (token?.used) {
    statusIcon = <CheckCircle2 className="w-4 h-4 text-green-500" />
    statusText = token.completed_at
      ? new Date(token.completed_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      : "Completado"
    statusClass = "text-green-600"
  } else if (token) {
    statusIcon = <Clock className="w-4 h-4 text-amber-400" />
    statusText = "Pendiente"
    statusClass = "text-amber-600"
  }

  const hasResponses = responses.length > 0

  return (
    <div className="border-b last:border-0">
      <div
        className={`flex items-center gap-3 px-4 py-2.5 ${hasResponses ? "cursor-pointer hover:bg-muted/40" : ""}`}
        onClick={() => hasResponses && setOpen(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {student.last_name}, {student.first_name}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {Object.entries(byType).map(([type, targets]) => {
            const meta = relationMeta[type as RelationType]
            return (
              <span key={type} className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${meta?.color ?? "bg-muted text-muted-foreground"}`}>
                {meta?.label ?? type} {targets.length}
              </span>
            )
          })}
        </div>

        <div className={`flex items-center gap-1.5 text-xs shrink-0 ${statusClass}`}>
          {statusIcon}
          <span className="hidden sm:inline">{statusText}</span>
        </div>

        {hasResponses && (
          <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </div>

      {open && hasResponses && (
        <div className="px-4 pb-3 pt-1 bg-muted/20 space-y-2">
          {Object.entries(byType).map(([type, targetIds]) => {
            const meta = relationMeta[type as RelationType]
            const Icon = meta?.icon
            return (
              <div key={type}>
                <p className={`text-xs font-semibold mb-1 flex items-center gap-1 ${meta?.color ?? ""}`}>
                  {Icon && <Icon className="w-3 h-3" />}
                  {meta?.label ?? type}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {targetIds.map(tid => (
                    <span key={tid} className="text-xs bg-background border rounded-full px-2.5 py-0.5 text-foreground">
                      {studentMap[tid] ?? "Alumno desconocido"}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
