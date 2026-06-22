"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Trash2 } from "lucide-react"

interface Note {
  id: string
  content: string
  created_by_name: string | null
  created_at: string
}

interface InterventionNotesProps {
  processId: string
  studentId: string
}

export function InterventionNotes({ processId, studentId }: InterventionNotesProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [content, setContent] = useState("")

  const loadNotes = useCallback(async () => {
    const res = await fetch(`/api/processes/${processId}/students/${studentId}/notes`)
    if (res.ok) setNotes(await res.json())
    setLoading(false)
  }, [processId, studentId])

  useEffect(() => { loadNotes() }, [loadNotes])

  async function handleSave() {
    if (!content.trim()) return
    setSaving(true)
    const res = await fetch(`/api/processes/${processId}/students/${studentId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    })
    if (res.ok) {
      toast.success("Nota guardada")
      setContent("")
      setAdding(false)
      loadNotes()
    } else {
      const json = await res.json().catch(() => ({}))
      toast.error(json.error ?? "Error al guardar la nota")
    }
    setSaving(false)
  }

  async function handleDelete(noteId: string) {
    const res = await fetch(
      `/api/processes/${processId}/students/${studentId}/notes?noteId=${noteId}`,
      { method: "DELETE" }
    )
    if (res.ok) {
      toast.success("Nota eliminada")
      setNotes(prev => prev.filter(n => n.id !== noteId))
    } else {
      toast.error("Error al eliminar la nota")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando notas...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {notes.length === 0 && !adding && (
        <p className="text-sm text-gray-500 italic">Sin notas registradas todavía.</p>
      )}

      {notes.map(note => (
        <div key={note.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">
              {note.created_by_name ?? "—"} ·{" "}
              {new Date(note.created_at).toLocaleDateString("es-ES", {
                day: "2-digit", month: "short", year: "numeric",
              })}
            </p>
            <button
              onClick={() => handleDelete(note.id)}
              className="text-gray-300 hover:text-red-500 transition-colors"
              title="Eliminar nota"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      {adding ? (
        <div className="space-y-2">
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={4}
            maxLength={2000}
            placeholder="Escribe la acción, acuerdo o observación del equipo..."
            value={content}
            onChange={e => setContent(e.target.value)}
            autoFocus
          />
          <div className="flex items-center gap-2 justify-between">
            <span className="text-xs text-gray-400">{content.length}/2000</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setAdding(false); setContent("") }}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!content.trim() || saving}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Guardar nota
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setAdding(true)}
        >
          <Plus className="w-3.5 h-3.5" />
          Añadir nota de seguimiento
        </Button>
      )}
    </div>
  )
}
