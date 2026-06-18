import Link from "next/link"
import LogoBrand from "@/components/ui/LogoBrand"
import { ArrowRight, Users, Network, GitBranch, AlertTriangle, CheckCircle2, Star, Link2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DEMO_NODES } from "./demo-data"
import DemoSociogramWrapper from "./DemoSociogramWrapper"

const isolated = DEMO_NODES.filter(n => n.is_isolated)
const vulnerable = DEMO_NODES.filter(n => !n.is_isolated && n.is_vulnerable)
const leaders = DEMO_NODES.filter(n => n.is_leader)
const bridges = DEMO_NODES.filter(n => n.is_bridge)

const PROPOSAL_A = [
  { cls: "1ºA", count: 10, girls: 5, boys: 5, avg: 7.6, withFriend: 9, isolated: 1, friends_pct: 90 },
  { cls: "1ºB", count: 10, girls: 5, boys: 5, avg: 7.5, withFriend: 10, isolated: 0, friends_pct: 100 },
]
const PROPOSAL_B = [
  { cls: "1ºA", count: 10, girls: 6, boys: 4, avg: 8.1, withFriend: 8, isolated: 1, friends_pct: 80 },
  { cls: "1ºB", count: 10, girls: 4, boys: 6, avg: 7.0, withFriend: 9, isolated: 1, friends_pct: 90 },
]

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* Nav */}
      <header className="border-b bg-white/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoBrand size="sm" />
            <span className="font-bold text-lg tracking-tight">ClassMixer</span>
            <Badge variant="secondary" className="text-xs">Demo</Badge>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-gray-500 hover:text-gray-900" asChild>
              <Link href="/">← Volver</Link>
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-md border-0" asChild>
              <Link href="/login">Acceder <ArrowRight className="w-4 h-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-sm text-indigo-700 font-medium mb-5">
            <Network className="w-3.5 h-3.5" /> Demo interactiva — datos de muestra
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Demo: <span className="text-indigo-600">Mezcla 6º Primaria → 1º ESO</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            20 alumnos de dos clases. Cuestionario sociométrico completado. Sociograma calculado.
            Dos propuestas de mezcla generadas. Todo esto en una plataforma real.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">

        {/* Sociogram section */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Network className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Sociograma interactivo</h2>
              <p className="text-sm text-gray-500">Relaciones sociales detectadas a partir del cuestionario</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            {/* Graph */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ height: 420 }}>
              <DemoSociogramWrapper />
            </div>

            {/* Right panel */}
            <div className="space-y-3">
              {/* Stats */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Métricas del grupo</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Alumnos", value: DEMO_NODES.length, icon: Users },
                    { label: "Comunidades", value: 4, icon: Network },
                    { label: "Aislados", value: isolated.length, danger: true },
                    { label: "Vulnerables", value: vulnerable.length, warn: true },
                    { label: "Líderes", value: leaders.length, good: true },
                    { label: "Puentes", value: bridges.length, info: true },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
                      <p className={`text-2xl font-black ${s.danger ? "text-red-500" : s.warn ? "text-orange-400" : s.good ? "text-amber-500" : s.info ? "text-indigo-500" : "text-gray-800"}`}>
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-xs space-y-2">
                <p className="font-semibold text-gray-400 uppercase tracking-wider text-xs mb-2">Tipos detectados</p>
                {[
                  { color: "#f59e0b", label: "Borde dorado = Líder social", icon: Star },
                  { color: "#6366f1", label: "Borde índigo = Alumno puente", icon: Link2 },
                  { color: "#f97316", label: "Borde naranja = Vulnerable", icon: AlertTriangle },
                  { color: "#ef4444", label: "Borde rojo = Aislado", icon: ShieldAlert },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 shrink-0 bg-gray-100" style={{ borderColor: item.color }} />
                    <span className="text-gray-500">{item.label}</span>
                  </div>
                ))}
                <div className="border-t pt-2 space-y-1.5 mt-1">
                  {[
                    { color: "#2563eb", label: "Línea gruesa = Amistad recíproca" },
                    { color: "#93c5fd", label: "Línea fina = Amistad unilateral" },
                    { color: "#4ade80", label: "Línea verde = Relación de trabajo" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div className="w-6 h-0 border-t-2 shrink-0" style={{ borderColor: item.color }} />
                      <span className="text-gray-500">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Alerts */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <h2 className="font-bold text-base">Alertas detectadas</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-1.5 text-red-800 font-semibold text-sm mb-1">
                <span className="w-2 h-2 rounded-full bg-red-500" /> Aislamiento — alta severidad
              </div>
              <p className="text-xs text-red-700 mb-2">Sin elecciones recibidas, sin relaciones recíprocas.</p>
              <div className="flex flex-wrap gap-1">
                {isolated.map(n => <span key={n.id} className="bg-white text-xs px-1.5 py-0.5 rounded text-red-700 border border-red-200">{n.first_name} {n.last_name}</span>)}
              </div>
            </div>
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-1.5 text-orange-800 font-semibold text-sm mb-1">
                <span className="w-2 h-2 rounded-full bg-orange-400" /> Vulnerabilidad — media severidad
              </div>
              <p className="text-xs text-orange-700 mb-2">Solo una relación significativa. Si se separan, quedan sin vínculos.</p>
              <div className="flex flex-wrap gap-1">
                {vulnerable.map(n => <span key={n.id} className="bg-white text-xs px-1.5 py-0.5 rounded text-orange-700 border border-orange-200">{n.first_name} {n.last_name}</span>)}
              </div>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <div className="flex items-center gap-1.5 text-indigo-800 font-semibold text-sm mb-1">
                <span className="w-2 h-2 rounded-full bg-indigo-400" /> Alumnos puente — informativa
              </div>
              <p className="text-xs text-indigo-700 mb-2">Conectan comunidades distintas. Su distribución es estratégica.</p>
              <div className="flex flex-wrap gap-1">
                {bridges.map(n => <span key={n.id} className="bg-white text-xs px-1.5 py-0.5 rounded text-indigo-700 border border-indigo-200">{n.first_name} {n.last_name}</span>)}
              </div>
            </div>
          </div>
        </section>

        {/* Proposals comparison */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Propuestas generadas por el algoritmo</h2>
              <p className="text-sm text-gray-500">Cada propuesta incluye métricas de equilibrio social, académico y de género</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Proposal A */}
            <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b">
                <div>
                  <p className="font-bold">Propuesta A</p>
                  <p className="text-xs text-gray-400 mt-0.5">Equilibrio social máximo</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-indigo-600">88</p>
                  <p className="text-xs text-gray-400">puntuación total</p>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                {PROPOSAL_A.map(c => (
                  <div key={c.cls} className="rounded-xl bg-gray-50 p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{c.cls}</span>
                      <span className="text-xs text-gray-400">{c.count} alumnos · nota media {c.avg}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400">Género</p>
                        <p className="font-semibold">{c.girls}♀ {c.boys}♂</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Con amigo</p>
                        <p className={`font-semibold ${c.withFriend === c.count ? "text-green-600" : "text-orange-500"}`}>{c.withFriend}/{c.count}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Sin vínculos</p>
                        <p className={`font-semibold ${c.isolated === 0 ? "text-green-600" : "text-red-500"}`}>{c.isolated}</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                        <span>Amistades preservadas</span>
                        <span>{c.friends_pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${c.friends_pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 pb-4">
                <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> 0 reglas obligatorias incumplidas · Lucía y Mario separados ✓ · Noa con Lucía ✓
                </div>
              </div>
            </div>

            {/* Proposal B */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b">
                <div>
                  <p className="font-bold text-gray-700">Propuesta B</p>
                  <p className="text-xs text-gray-400 mt-0.5">Equilibrio académico máximo</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-gray-500">82</p>
                  <p className="text-xs text-gray-400">puntuación total</p>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                {PROPOSAL_B.map(c => (
                  <div key={c.cls} className="rounded-xl bg-gray-50 p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-gray-700">{c.cls}</span>
                      <span className="text-xs text-gray-400">{c.count} alumnos · nota media {c.avg}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400">Género</p>
                        <p className="font-semibold text-gray-600">{c.girls}♀ {c.boys}♂</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Con amigo</p>
                        <p className={`font-semibold ${c.withFriend === c.count ? "text-green-600" : "text-orange-500"}`}>{c.withFriend}/{c.count}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Sin vínculos</p>
                        <p className={`font-semibold ${c.isolated === 0 ? "text-green-600" : "text-red-500"}`}>{c.isolated}</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                        <span>Amistades preservadas</span>
                        <span>{c.friends_pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-400 rounded-full" style={{ width: `${c.friends_pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 pb-4">
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> 2 alumnos sin vínculo conocido en su nueva clase
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Diferenciadores */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-base mb-4">¿Qué hace único a ClassMixer?</h2>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            {[
              {
                icon: Network, color: "indigo",
                title: "Sociograma + algoritmo en un mismo flujo",
                desc: "El sociograma alimenta directamente el algoritmo de mezcla. No son herramientas separadas."
              },
              {
                icon: GitBranch, color: "violet",
                title: "Motor de reglas pedagógicas",
                desc: "9 tipos de reglas configurables. El docente siempre puede sobreescribir cualquier decisión."
              },
              {
                icon: CheckCircle2, color: "green",
                title: "Supervisión humana obligatoria",
                desc: "Ninguna mezcla se ejecuta sin revisión. El profesorado aprueba, ajusta y exporta."
              },
            ].map(f => (
              <div key={f.title} className="flex gap-3">
                <div className={`w-9 h-9 rounded-xl bg-${f.color}-50 border border-${f.color}-100 flex items-center justify-center shrink-0`}>
                  <f.icon className={`w-4 h-4 text-${f.color}-600`} />
                </div>
                <div>
                  <p className="font-semibold mb-1">{f.title}</p>
                  <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden bg-indigo-600 rounded-2xl py-10 px-8 text-center">
          <div className="absolute inset-0 pointer-events-none opacity-10"
            style={{ backgroundImage: "linear-gradient(white 1px,transparent 1px),linear-gradient(90deg,white 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">¿Lo quieres en tu centro?</h2>
            <p className="text-indigo-200 mb-6 max-w-md mx-auto text-sm leading-relaxed">
              Accede con las credenciales de tu centro y prueba la versión completa con tus propios alumnos.
            </p>
            <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 border-0 h-12 px-10 font-semibold shadow-xl" asChild>
              <Link href="/login">Acceder a la plataforma <ArrowRight className="w-4 h-4" /></Link>
            </Button>
          </div>
        </section>

      </div>

      <footer className="border-t bg-white py-6 mt-4">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <LogoBrand size="xs" />
            <span className="font-semibold text-gray-600">ClassMixer</span>
            <span>· Demo pública — datos de muestra</span>
          </div>
          <Link href="/" className="hover:text-gray-600 transition-colors">← Volver a la web</Link>
        </div>
      </footer>
    </div>
  )
}
