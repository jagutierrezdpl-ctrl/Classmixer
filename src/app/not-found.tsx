import Link from "next/link"
import { GraduationCap, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <GraduationCap className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-6xl font-bold text-muted-foreground/30 mb-2">404</h1>
      <h2 className="text-xl font-semibold mb-2">Página no encontrada</h2>
      <p className="text-muted-foreground text-sm mb-8 max-w-sm">
        Esta página no existe o ha sido eliminada. Vuelve al panel principal.
      </p>
      <Button asChild>
        <Link href="/dashboard">
          <ArrowLeft className="w-4 h-4" />
          Ir al dashboard
        </Link>
      </Button>
    </div>
  )
}
