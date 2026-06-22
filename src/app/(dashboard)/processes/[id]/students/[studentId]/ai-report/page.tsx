"use client"

import { use, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, Sparkles, Loader2, Clock, Copy, Printer,
  AlertTriangle, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react"

interface AIReport {
  id: string
  content: string
  created_at: string
  created_by_name: string | null
}

export default function AIReportPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>
}) {
  const { id: processId, studentId } = use(params)
  const [reports, setReports] = useState<AIReport[]>([])
  const [activeReport, setActiveReport] = useState<AIReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [context, setContext] = useState("")
  const [showContext, setShowContext] = useState(false)

  const loadReports = useCallback(async () => {
    const res = await fetch(`/api/processes/${processId}/students/${studentId}/ai-report`)
    if (res.ok) {
      const data = await res.json()
      setReports(data)
      if (data.length > 0) setActiveReport(data[0])
    }
    setLoading(false)
  }, [processId, studentId])

  useEffect(() => { loadReports() }, [loadReports])

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/processes/${processId}/students/${studentId}/ai-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additional_context: context.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        const newReport: AIReport = {
          id: data.id,
          content: data.report,
          created_at: new Date().toISOString(),
          created_by_name: null,
        }
        setReports(prev => [newReport, ...prev])
        setActiveReport(newReport)
        toast.success("Informe generado")
      } else {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error ?? "Error generando informe")
      }
    } catch {
      toast.error("Error de conexión")
    }
    setGenerating(false)
  }

  function copyToClipboard() {
    if (activeReport) {
      navigator.clipboard.writeText(activeReport.content)
      toast.success("Copiado al portapapeles")
    }
  }

  function printReport() {
    window.print()
  }

  // Render markdown-like content as HTML (minimal, no library needed)
  function renderContent(text: string) {
    return text
      .split("\n")
      .map((line, i) => {
        if (line.startsWith("## ")) return <h2 key={i} className="text-base font-bold mt-4 mb-1 text-gray-900">{line.slice(3)}</h2>
        if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-semibold mt-3 mb-1 text-gray-800">{line.slice(4)}</h3>
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-sm">{line.slice(2, -2)}</p>
        if (line.startsWith("• ") || line.startsWith("- ")) return <li key={i} className="ml-4 text-sm text-gray-700">{line.slice(2)}</li>
        if (line.startsWith("[BORRADOR")) return <p key={i} className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 italic">{line}</p>
        if (line.trim() === "") return <div key={i} className="h-2" />
        return <p key={i} className="text-sm text-gray-700">{line}</p>
      })
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl print:p-0">
      <div className="flex items-center gap-3 print:hidden">
        <Link href={`/processes/${processId}/students/${studentId}/report`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Copiloto de IA — Informe de orientación
          </h1>
          <p className="text-muted-foreground text-sm">
            Informe psicopedagógico asistido por IA · Solo visible para admin y orientador
          </p>
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            Generar nuevo informe
            <Button variant="ghost" size="sm" onClick={() => setShowContext(!showContext)}>
              {showContext ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Contexto adicional
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {showContext && (
            <textarea
              className="w-full border rounded-md p-3 text-sm resize-none h-24"
              placeholder="Observaciones del equipo docente que quieras incluir en el informe (opcional)..."
              value={context}
              onChange={e => setContext(e.target.value)}
            />
          )}
          <div className="flex items-center gap-3">
            <Button onClick={generate} disabled={generating} className="bg-purple-600 hover:bg-purple-700">
              {generating
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando…</>
                : <><Sparkles className="w-4 h-4 mr-2" />Generar informe</>
              }
            </Button>
            {reports.length > 0 && (
              <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerar
              </Button>
            )}
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Requiere revisión del orientador
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* History selector */}
      {reports.length > 1 && (
        <div className="flex gap-2 flex-wrap print:hidden">
          {reports.map((r, i) => (
            <Button
              key={r.id}
              variant={activeReport?.id === r.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveReport(r)}
            >
              <Clock className="w-3 h-3 mr-1" />
              {i === 0 ? "Más reciente" : new Date(r.created_at).toLocaleDateString("es-ES")}
            </Button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && !activeReport && !generating && (
        <Card className="text-center py-16">
          <CardContent>
            <Sparkles className="w-12 h-12 mx-auto text-purple-400 mb-4" />
            <p className="font-medium">Sin informes generados</p>
            <p className="text-muted-foreground text-sm mt-1">
              Haz clic en &quot;Generar informe&quot; para crear el primer informe psicopedagógico asistido.
            </p>
          </CardContent>
        </Card>
      )}

      {activeReport && (
        <Card>
          <CardHeader className="print:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date(activeReport.created_at).toLocaleDateString("es-ES", {
                    day: "numeric", month: "long", year: "numeric",
                    hour: "2-digit", minute: "2-digit"
                  })}
                </Badge>
                {activeReport.created_by_name && (
                  <span className="text-xs text-muted-foreground">por {activeReport.created_by_name}</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={printReport}>
                  <Printer className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none space-y-1">
              {renderContent(activeReport.content)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
