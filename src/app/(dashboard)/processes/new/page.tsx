"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { createProcessSchema, type CreateProcessInput } from "@/schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, ArrowLeft, Shuffle, Network, CheckCircle2, AlertTriangle, Users } from "lucide-react"
import Link from "next/link"

const PROCESS_TYPES = [
  {
    value: "mezcla" as const,
    label: "Mezcla de clases",
    description: "Reorganiza grupos existentes en nuevas clases para el siguiente curso.",
    icon: Shuffle,
    color: "bg-blue-500",
  },
  {
    value: "sociograma" as const,
    label: "Solo sociograma",
    description: "Analiza las relaciones sociales de una clase sin mezclar grupos.",
    icon: Network,
    color: "bg-violet-500",
  },
]

interface Group {
  name: string
  count: number
  school_year?: string
}

export default function NewProcessPage() {
  const [loading, setLoading] = useState(false)
  const [processType, setProcessType] = useState<"mezcla" | "sociograma">("mezcla")
  const [groups, setGroups] = useState<Group[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [selectedSourceGroups, setSelectedSourceGroups] = useState<string[]>([])
  const router = useRouter()

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<CreateProcessInput>({
    resolver: zodResolver(createProcessSchema),
    defaultValues: {
      process_type: "mezcla",
      target_class_count: 2,
      min_class_size: 20,
      max_class_size: 30,
    },
  })

  useEffect(() => {
    fetch("/api/student-profiles/groups")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setGroups(data)
      })
      .catch(() => {})
      .finally(() => setGroupsLoading(false))
  }, [])

  function toggleSourceGroup(name: string) {
    setSelectedSourceGroups(prev => {
      const next = prev.includes(name) ? prev.filter(g => g !== name) : [...prev, name]
      setValue("source_groups", next.join(", "))
      return next
    })
  }

  function selectType(type: "mezcla" | "sociograma") {
    setProcessType(type)
    setValue("process_type", type)
  }

  async function onSubmit(data: CreateProcessInput) {
    if (selectedSourceGroups.length === 0) {
      toast.error("Selecciona al menos un grupo de origen")
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...data,
        source_groups: selectedSourceGroups.join(", "),
        target_level: data.process_type === "sociograma" ? data.source_level : (data.target_level ?? data.source_level),
        target_groups: data.process_type === "sociograma" ? selectedSourceGroups.join(", ") : (data.target_groups ?? ""),
        target_class_count: data.process_type === "sociograma" ? 1 : (data.target_class_count ?? 2),
        min_class_size: data.min_class_size ?? 20,
        max_class_size: data.max_class_size ?? 30,
      }
      const res = await fetch("/api/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Error al crear el proceso")
      }
      const { id } = await res.json()
      toast.success("Proceso creado correctamente")
      router.push(`/processes/${id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear el proceso")
      setLoading(false)
    }
  }

  const isSociograma = processType === "sociograma"
  const noGroups = !groupsLoading && groups.length === 0

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/processes"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nuevo proceso</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configura el tipo y los parámetros</p>
        </div>
      </div>

      {/* No groups warning */}
      {noGroups && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">No hay grupos disponibles</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Importa alumnos en la sección <strong>Alumnado</strong> antes de crear un proceso.
              Los grupos se generan automáticamente al importar.
            </p>
            <Button variant="outline" size="sm" className="mt-3 text-amber-800 border-amber-300" asChild>
              <Link href="/alumnado">Ir a Alumnado</Link>
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* Type selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">¿Qué quieres hacer?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {PROCESS_TYPES.map(pt => {
                const Icon = pt.icon
                const active = processType === pt.value
                return (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => selectType(pt.value)}
                    className={`relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 text-center transition-all ${
                      active ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30 hover:bg-muted/20"
                    }`}
                  >
                    {active && <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-primary" />}
                    <div className={`w-10 h-10 rounded-lg ${pt.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${active ? "text-primary" : ""}`}>{pt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{pt.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            <input type="hidden" {...register("process_type")} />
            <input type="hidden" {...register("source_groups")} />
          </CardContent>
        </Card>

        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre del proceso *</Label>
              <Input
                id="name"
                placeholder={isSociograma ? "Ej: Sociograma 5ºA 2025-2026" : "Ej: Mezcla 6º Primaria para 1º ESO"}
                {...register("name")}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="school_year">Curso escolar *</Label>
              <Input id="school_year" placeholder="Ej: 2025-2026" {...register("school_year")} />
              {errors.school_year && <p className="text-xs text-destructive">{errors.school_year.message}</p>}
            </div>

            {/* Source level */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="source_level">{isSociograma ? "Nivel / Etapa *" : "Nivel de origen *"}</Label>
                <Input id="source_level" placeholder="Ej: 6º Primaria" {...register("source_level")} />
                {errors.source_level && <p className="text-xs text-destructive">{errors.source_level.message}</p>}
              </div>
              {!isSociograma && (
                <div className="space-y-1.5">
                  <Label htmlFor="target_level">Nivel destino *</Label>
                  <Input id="target_level" placeholder="Ej: 1º ESO" {...register("target_level")} />
                  {errors.target_level && <p className="text-xs text-destructive">{errors.target_level.message}</p>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Source groups — selectable */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              {isSociograma ? "Grupos a analizar *" : "Grupos de origen *"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {groupsLoading ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando grupos...
              </div>
            ) : groups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No hay grupos disponibles. Importa alumnos primero.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {groups.map(g => {
                  const checked = selectedSourceGroups.includes(g.name)
                  return (
                    <label
                      key={g.name}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        checked ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleSourceGroup(g.name)}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{g.name}</p>
                        <p className="text-xs text-muted-foreground">{g.count} alumnos</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
            {selectedSourceGroups.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Seleccionados: <span className="font-medium">{selectedSourceGroups.join(", ")}</span>
              </p>
            )}
            {errors.source_groups && (
              <p className="text-xs text-destructive mt-1">{errors.source_groups.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Target groups — only for mezcla */}
        {!isSociograma && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Grupos destino (nuevas clases) *</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="target_groups">Nombres de las nuevas clases</Label>
                  <Input
                    id="target_groups"
                    placeholder="Ej: 1A, 1B, 1C"
                    {...register("target_groups")}
                  />
                  <p className="text-xs text-muted-foreground">Separados por comas. Ej: 1A, 1B</p>
                  {errors.target_groups && <p className="text-xs text-destructive">{errors.target_groups.message}</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configuración de clases destino</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="target_class_count">Nº de clases</Label>
                    <Input id="target_class_count" type="number" min={1} max={20} {...register("target_class_count", { valueAsNumber: true })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="min_class_size">Mínimo alumnos</Label>
                    <Input id="min_class_size" type="number" min={1} max={50} {...register("min_class_size", { valueAsNumber: true })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="max_class_size">Máximo alumnos</Label>
                    <Input id="max_class_size" type="number" min={1} max={50} {...register("max_class_size", { valueAsNumber: true })} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Deadline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fecha límite del cuestionario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label htmlFor="questionnaire_deadline">Cierre automático</Label>
              <Input id="questionnaire_deadline" type="date" {...register("questionnaire_deadline")} />
              <p className="text-xs text-muted-foreground">
                Si configuras una fecha, el cuestionario se cerrará automáticamente ese día.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={loading || noGroups || selectedSourceGroups.length === 0}
            className="flex-1"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</> : `Crear ${isSociograma ? "sociograma" : "proceso"}`}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/processes">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
