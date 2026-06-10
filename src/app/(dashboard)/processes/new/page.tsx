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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function NewProcessPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const { register, handleSubmit, formState: { errors } } = useForm<CreateProcessInput>({
    resolver: zodResolver(createProcessSchema),
    defaultValues: {
      target_class_count: 2,
      min_class_size: 20,
      max_class_size: 30,
    },
  })

  async function onSubmit(data: CreateProcessInput) {
    setLoading(true)
    try {
      const res = await fetch("/api/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/processes"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nuevo proceso</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configura el proceso de mezcla de clases</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre del proceso *</Label>
              <Input id="name" placeholder="Ej: Mezcla 6º Primaria para 1º ESO" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="school_year">Curso escolar *</Label>
              <Input id="school_year" placeholder="Ej: 2025-2026" {...register("school_year")} />
              {errors.school_year && <p className="text-xs text-destructive">{errors.school_year.message}</p>}
            </div>

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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuración de clases</CardTitle>
            <CardDescription>Define el tamaño de los grupos destino</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="target_class_count">Nº de clases</Label>
                <Input id="target_class_count" type="number" min={1} max={20} {...register("target_class_count", { valueAsNumber: true })} />
                {errors.target_class_count && <p className="text-xs text-destructive">{errors.target_class_count.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min_class_size">Mínimo alumnos</Label>
                <Input id="min_class_size" type="number" min={1} max={50} {...register("min_class_size", { valueAsNumber: true })} />
                {errors.min_class_size && <p className="text-xs text-destructive">{errors.min_class_size.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_class_size">Máximo alumnos</Label>
                <Input id="max_class_size" type="number" min={1} max={50} {...register("max_class_size", { valueAsNumber: true })} />
                {errors.max_class_size && <p className="text-xs text-destructive">{errors.max_class_size.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="questionnaire_deadline">Fecha límite del cuestionario</Label>
              <Input id="questionnaire_deadline" type="date" {...register("questionnaire_deadline")} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</> : "Crear proceso"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/processes">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
