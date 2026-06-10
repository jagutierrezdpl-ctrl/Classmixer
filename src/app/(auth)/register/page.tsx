"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { registerCenterSchema, type RegisterCenterInput } from "@/schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GraduationCap, Loader2, Building2, UserCircle, ArrowRight, CheckCircle2 } from "lucide-react"
import Link from "next/link"

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterCenterInput>({
    resolver: zodResolver(registerCenterSchema),
    defaultValues: { country: "España" },
  })

  const watchType = watch("center_type")

  async function onSubmit(data: RegisterCenterInput) {
    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg = typeof json.error === "string" ? json.error : "Error al registrar el centro"
        toast.error(msg)
        return
      }
      setDone(true)
    } catch {
      toast.error("Error de conexión. Inténtalo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-3">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold">ClassMixer</h1>
          </div>
          <Card>
            <CardContent className="pt-8 pb-8 space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-lg font-bold">¡Casi listo!</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Hemos enviado un email de confirmación a tu dirección.<br />
                Haz clic en el enlace del email para activar tu cuenta.
              </p>
              <p className="text-xs text-muted-foreground">
                ¿No lo ves? Revisa la carpeta de spam.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/login")}
              >
                Volver al inicio de sesión
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-3">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">ClassMixer</h1>
          <p className="text-muted-foreground text-sm mt-1">Registra tu centro educativo</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Center section */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Datos del centro</h2>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="center_name">Nombre del centro *</Label>
                <Input
                  id="center_name"
                  placeholder="CEIP San Marcos"
                  {...register("center_name")}
                />
                {errors.center_name && (
                  <p className="text-xs text-destructive">{errors.center_name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="city">Ciudad *</Label>
                  <Input
                    id="city"
                    placeholder="Madrid"
                    {...register("city")}
                  />
                  {errors.city && (
                    <p className="text-xs text-destructive">{errors.city.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country">País</Label>
                  <Input
                    id="country"
                    placeholder="España"
                    {...register("country")}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Tipo de centro</Label>
                <Select
                  value={watchType ?? ""}
                  onValueChange={v => setValue("center_type", v as RegisterCenterInput["center_type"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="publico">Público</SelectItem>
                    <SelectItem value="concertado">Concertado</SelectItem>
                    <SelectItem value="privado">Privado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    placeholder="91 234 56 78"
                    {...register("phone")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="web">Web</Label>
                  <Input
                    id="web"
                    placeholder="www.colegio.es"
                    {...register("web")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admin account section */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <UserCircle className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Cuenta de administrador</h2>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin_name">Nombre completo *</Label>
                <Input
                  id="admin_name"
                  placeholder="María García López"
                  {...register("admin_name")}
                />
                {errors.admin_name && (
                  <p className="text-xs text-destructive">{errors.admin_name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="director@colegio.es"
                  autoComplete="email"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña *</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    {...register("password")}
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm_password">Confirmar contraseña *</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repite la contraseña"
                    {...register("confirm_password")}
                  />
                  {errors.confirm_password && (
                    <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creando cuenta...
              </>
            ) : (
              <>
                Crear cuenta y continuar
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Al registrarte aceptas el uso responsable de datos de alumnos conforme al RGPD.
          </p>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
