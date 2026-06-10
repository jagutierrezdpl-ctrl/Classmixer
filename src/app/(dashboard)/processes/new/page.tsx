"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { createProcessSchema, type CreateProcessInput } from "@/schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowLeft, Shuffle, Network, CheckCircle2 } from "lucide-react"
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

export default function NewProcessPage() {
  const [loading, setLoading] = useState(false)
  const [processType, setProcessType] = useState<"mezcla" | "sociograma">("mezcla")
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

  function selectType(type: "mezcla" | "sociograma") {
    setProcessType(type)
    setValue("process_type", type)
  }

  async function onSubmit(data: CreateProcessInput) {
    setLoading(true)
    try {
      // For sociograma type, use source as target too (no mixing)
      const payload = {
        ...data,
        target_level: data.process_type === "sociograma" ? data.source_level : (data.target_level ?? data.source_level),
        target_groups: data.process_type === "sociograma" ? data.source_groups : (data.target_groups ?? ""),
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

            {isSociograma ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="source_level">Nivel / Etapa *</Label>
                  <Input id="source_level" placeholder="Ej: 5º Primaria" {...register("source_level")} />
                  {errors.source_level && <p className="text-xs text-destructive">{errors.source_level.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="source_groups_soc">Grupos *</Label>
                  <Input id="source_groups_soc" placeholder="Ej: 5A, 5B" {...register("source_groups")} />
                  {errors.source_groups && <p className="text-xs text-destructive">{errors.source_groups.message}</p>}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="source_level">Nivel de origen *</Label>
                    <Input id="source_level" placeholder="Ej: 6º Primaria" {...register("source_level")} />
                    {errors.source_level && <p className="text-xs text-destructive">{errors.source_level.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="target_level">Nivel destino *</Label>
                    <Input id="target_level" placeholder="Ej: 1º ESO" {...register("target_level")} />
                    {errors.target_level && <p className="text-xs text-destructive">{errors.target_level.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="source_groups">Grupos de origen *</Label>
                    <Input id="source_groups" placeholder="Ej: 6A, 6B, 6C" {...register("source_groups")} />
                    <p className="text-xs text-muted-foreground">Separados por comas</p>
                    {errors.source_groups && <p className="text-xs text-destructive">{errors.source_groups.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="target_groups">Grupos destino *</Label>
                    <Input id="target_groups" placeholder="Ej: 1A, 1B" {...register("target_groups")} />
                    <p className="text-xs text-muted-foreground">Separados por comas</p>
                    {errors.target_groups && <p className="text-xs text-destructive">{errors.target_groups.message}</p>}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Class config — only for mezcla */}
        {!isSociograma && (
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
          <Button type="submit" disabled={loading} className="flex-1">
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
