"use client"

// Visual card-grid student picker for the gamified questionnaire.
// Replaces the search+list pattern with a visual grid of avatar cards.
// Students are shown as colored cards; click selects them in order (1st, 2nd, 3rd…).
// Works alongside the existing text search as a filter.

import { useState, useMemo } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"

interface Student {
  id: string
  first_name: string
  last_name: string
  current_class: string
}

interface StudentCardGridProps {
  students: Student[]
  selected: string[]            // ordered array of student IDs
  max: number
  color: string                 // tailwind color class e.g. "pink"
  onToggle: (id: string) => void
  orderLabels?: string[]
}

const AVATAR_COLORS = [
  "bg-pink-400", "bg-purple-400", "bg-blue-400", "bg-green-400",
  "bg-yellow-400", "bg-orange-400", "bg-teal-400", "bg-indigo-400",
  "bg-red-400", "bg-cyan-400", "bg-lime-400", "bg-fuchsia-400",
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[hash]
}

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

export function StudentCardGrid({ students, selected, max, color, onToggle, orderLabels }: StudentCardGridProps) {
  const [search, setSearch] = useState("")

  const ORDER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]

  const filtered = useMemo(() => {
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter(s =>
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q) ||
      s.current_class?.toLowerCase().includes(q)
    )
  }, [students, search])

  const selectedSet = new Set(selected)

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o clase…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Selected order strip */}
      {selected.length > 0 && (
        <div className="flex gap-2 flex-wrap p-2 bg-gray-50 rounded-lg border">
          {selected.map((sid, idx) => {
            const s = students.find(s => s.id === sid)
            if (!s) return null
            return (
              <button
                key={sid}
                onClick={() => onToggle(sid)}
                className="flex items-center gap-1.5 bg-white border rounded-full px-2 py-0.5 text-xs font-medium hover:bg-red-50 hover:border-red-200 transition-colors"
              >
                <span>{ORDER_EMOJIS[idx] ?? `${idx + 1}º`}</span>
                <span>{s.first_name}</span>
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )
          })}
        </div>
      )}

      {/* Card grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {filtered.map(s => {
          const isSelected = selectedSet.has(s.id)
          const order = selected.indexOf(s.id)
          const canAdd = !isSelected && selected.length < max
          const avatarColor = getAvatarColor(s.first_name + s.last_name)

          return (
            <button
              key={s.id}
              onClick={() => (canAdd || isSelected) && onToggle(s.id)}
              disabled={!canAdd && !isSelected}
              className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 text-center transition-all select-none
                ${isSelected
                  ? `border-${color}-400 bg-${color}-50 shadow-sm scale-[1.03]`
                  : canAdd
                  ? "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 active:scale-95"
                  : "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                }
              `}
            >
              {/* Order badge */}
              {isSelected && (
                <span className="absolute -top-1.5 -right-1.5 text-sm leading-none">
                  {ORDER_EMOJIS[order] ?? `${order + 1}º`}
                </span>
              )}

              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${avatarColor}`}>
                {initials(s.first_name, s.last_name)}
              </div>

              {/* Name */}
              <div className="w-full">
                <p className="text-xs font-semibold leading-tight truncate">{s.first_name}</p>
                <p className="text-[10px] text-muted-foreground leading-tight truncate">{s.last_name}</p>
              </div>

              {/* Class badge */}
              <span className="text-[10px] bg-gray-100 text-gray-600 rounded px-1">{s.current_class}</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-4">
          No se encontraron compañeros con ese nombre
        </p>
      )}
    </div>
  )
}
