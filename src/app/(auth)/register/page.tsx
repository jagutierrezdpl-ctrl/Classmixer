import Link from "next/link"
import LogoBrand from "@/components/ui/LogoBrand"
import { Lock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function RegisterDisabledPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <LogoBrand size="md" />
          <h1 className="text-2xl font-bold">ClassMixer</h1>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
            <CardTitle>Registro deshabilitado</CardTitle>
            <CardDescription>
              El acceso a ClassMixer es por invitación. Los nuevos centros deben
              ser creados por el administrador del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="w-full">
              <Link href="/login">Ir al inicio de sesión</Link>
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Si eres tutor u orientador, solicita la invitación al administrador de tu centro.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
