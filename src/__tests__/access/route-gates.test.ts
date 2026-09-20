import { describe, it, expect } from "vitest"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

// Red de seguridad estructural: los datos de alumnado y de procesos se sirven con el cliente de servicio
// (sin RLS), así que el único límite entre un profesor y los datos de otros grupos es el código de cada
// ruta. Este test lee el código fuente y exige que cada handler de API y cada página de servidor con
// datos lleve un control de acceso reconocible, o esté en una lista de excepciones con su motivo.
// No demuestra que el control sea correcto (eso lo hacen los tests de comportamiento de esta carpeta):
// impide que una ruta nueva, o una a la que se le quite el control, pase desapercibida.

const APP = fileURLToPath(new URL("../../app", import.meta.url))
const API = join(APP, "api")
const VERBS = ["GET", "POST", "PUT", "PATCH", "DELETE"]

// Limitan a un profesor (rol "tutor") a los procesos o al alumnado que le corresponden.
// `verifyProcessAccess` NO está aquí a propósito: solo comprueba que el proceso es del centro.
const SCOPE_GATES = [
  "canAccessProcess",
  "getAccessibleProcessIds",
  "canAccessGroupSession",
  "tutorCanAccessProcess",
  "getStudentAccessScope",
  "getTutorGroups",
  "getTutoredAndTaughtGroups",
  "getTutorClassAccess",
]

// Dejan fuera al profesorado: responden y salen antes de tocar datos si el rol no es de administración
// (o de orientación). Deben devolver de inmediato: un `if (!hasFullAccess) { …filtrar… }` no cuenta.
const ROLE_GATES = [
  /!\s*hasFullAccess\(\s*profile\.role\s*\)\s*\)\s*\{?\s*return\b/,
  /!\s*\[[^\]]*\]\.includes\(\s*profile\.role\s*\)\s*\)\s*\{?\s*return\b/,
  /profile\.role\s*!==\s*"superadmin"\s*\)\s*\{?\s*return\b/,
  // `hasFullAccess` ya incluye a orientación: la comparación extra es redundante pero sigue siendo un control duro
  /!\s*hasFullAccess\(\s*profile\.role\s*\)\s*&&\s*profile\.role\s*!==\s*"orientador"\s*\)\s*\{?\s*return\b/,
]

// Tareas programadas (Vercel Cron): no tienen sesión de usuario y solo pasa quien envía el secreto del
// entorno en la cabecera Authorization; un profesor no puede invocarlas. Se exige que el handler lea el
// secreto y responda de inmediato si no coincide (o si falta: entonces nadie entra).
const CRON_SECRET_READ = /=\s*process\.env\.CRON_SECRET\b/
const CRON_GATE = /if\s*\(\s*!\s*(\w+)\s*\|\|\s*\w+\s*!==\s*`Bearer \$\{\s*\1\s*\}`\s*\)\s*\{?\s*return\b/

// Rutas sin control de acceso por proceso/alumnado, cada una con el motivo.
const API_EXCEPTIONS: Record<string, string> = {
  "auth/callback/route.ts GET": "flujo de inicio de sesión (OAuth/OTP): crea la sesión, no sirve datos del centro",
  "auth/student-callback/route.ts GET": "inicio de sesión del alumno: solo enlaza su propia ficha con su token",
  "auth/register/route.ts POST": "alta de un centro y su primer administrador; no lee datos existentes",
  "auth/me/route.ts GET": "devuelve el propio perfil de la sesión",
  "auth/me/route.ts PATCH": "cambia solo el nombre de la propia cuenta",
  "q/[token]/route.ts GET": "cuestionario del alumno: acceso por token individual, sin sesión",
  "q/[token]/route.ts POST": "cuestionario del alumno: acceso por token individual, sin sesión",
  "license/route.ts GET": "licencia y contadores agregados del propio centro; sin datos de alumnado",
  "notifications/inbox/route.ts GET": "avisos del propio usuario o difundidos al centro; sin datos de alumnado",
  "notifications/inbox/route.ts PATCH": "marca avisos como leídos",
  "questionnaire/templates/route.ts GET": "plantillas de cuestionario; sin datos de alumnado",
  "student-profiles/export-template/route.ts GET": "plantilla Excel vacía",
  "processes/[id]/students/sge-template/route.ts GET": "plantilla Excel de ejemplo con datos ficticios",
  "groups/[name]/tutor/route.ts GET": "tutores de un grupo (nombre y email del personal del centro); sin datos de alumnado",
  "demo/route.ts GET": "solo procesos con curso 'DEMO' del centro, datos sintéticos",
  "demo/route.ts POST": "crea un proceso 'DEMO' con datos sintéticos",
  "demo/route.ts DELETE": "borra solo los procesos 'DEMO' del centro",
  "proposals/[id]/export/pdf/tutores/route.ts GET":
    "el rol tutor solo recibe las clases que tiene asignadas en la propuesta (proposal_class_tutors)",
}

// Páginas de servidor que consultan la base de datos, con el motivo si no llevan control propio.
const PAGE_EXCEPTIONS: Record<string, string> = {
  "(dashboard)/layout.tsx": "marco de la aplicación: solo lee el perfil y el centro de la sesión",
}

function walk(dir: string, match: (file: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walk(path, match)
    return match(path) ? [path] : []
  })
}

const rel = (base: string, file: string) => relative(base, file).split(sep).join("/")

// Un control mencionado en un comentario, o solo importado, no protege nada: se analiza el código sin
// comentarios y un control cuenta únicamente si se LLAMA (`nombre(`).
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1")
const calls = (text: string, name: string) => new RegExp(`\\b${name}\\s*\\(`).test(text)
const callsScopeGate = (text: string) => SCOPE_GATES.some((g) => calls(text, g))
const readCode = (file: string) => stripComments(readFileSync(file, "utf-8"))

/** Funciones de primer nivel de un fichero: nombre → texto. */
function topLevelFunctions(source: string): Record<string, string> {
  const starts = [...source.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm)]
  const out: Record<string, string> = {}
  starts.forEach((m, i) => {
    out[m[1]] = source.slice(m.index, starts[i + 1]?.index ?? source.length)
  })
  return out
}

/** Texto de un handler más el de las funciones locales que llama, transitivamente. */
function handlerText(fns: Record<string, string>, name: string): string {
  const seen = new Set<string>()
  const stack = [name]
  let text = ""
  while (stack.length) {
    const current = stack.pop()!
    if (seen.has(current) || !(current in fns)) continue
    seen.add(current)
    text += fns[current]
    for (const other of Object.keys(fns)) {
      if (!seen.has(other) && new RegExp(`\\b${other}\\s*\\(`).test(fns[current])) stack.push(other)
    }
  }
  return text
}

const gateOf = (text: string) => {
  if (callsScopeGate(text)) return "scope"
  if (ROLE_GATES.some((r) => r.test(text))) return "role"
  if (CRON_SECRET_READ.test(text) && CRON_GATE.test(text)) return "cron"
  return null
}

const routeFiles = walk(API, (f) => f.endsWith(`${sep}route.ts`))
const handlers = routeFiles.flatMap((file) => {
  const fns = topLevelFunctions(readCode(file))
  return VERBS.filter((v) => v in fns).map((verb) => ({
    key: `${rel(API, file)} ${verb}`,
    gate: gateOf(handlerText(fns, verb)),
  }))
})

describe("rutas de API: control de acceso", () => {
  it("encuentra las rutas (guarda contra un análisis vacío)", () => {
    expect(routeFiles.length).toBeGreaterThan(100)
    expect(handlers.length).toBeGreaterThan(150)
  })

  it("cada handler limita al profesorado por proceso o alumnado, o lo deja fuera por rol, o está justificado", () => {
    const missing = handlers.filter((h) => !h.gate && !(h.key in API_EXCEPTIONS)).map((h) => h.key)

    expect(missing, "handlers sin control de acceso ni excepción justificada").toEqual([])
  })

  it("las excepciones apuntan a handlers que existen y siguen sin control propio", () => {
    const byKey = new Map(handlers.map((h) => [h.key, h]))

    const stale = Object.keys(API_EXCEPTIONS).filter((k) => !byKey.has(k))
    expect(stale, "excepciones de handlers que ya no existen").toEqual([])

    // Si un handler excepcionado gana un control, la excepción sobra: se retira para no ocultar regresiones.
    const redundant = Object.keys(API_EXCEPTIONS).filter((k) => byKey.get(k)?.gate)
    expect(redundant, "excepciones que ya tienen control de acceso").toEqual([])
  })

  it("todas las excepciones explican su motivo", () => {
    for (const [key, reason] of Object.entries(API_EXCEPTIONS)) {
      expect(reason.trim().length, key).toBeGreaterThan(15)
    }
  })

  it("verifyProcessAccess (solo comprueba el centro) nunca es el único control de una ruta", () => {
    const onlyCenter = routeFiles.flatMap((file) => {
      const fns = topLevelFunctions(readCode(file))
      return VERBS.filter((v) => v in fns)
        .filter((v) => {
          const text = handlerText(fns, v)
          return calls(text, "verifyProcessAccess") && !gateOf(text)
        })
        .map((v) => `${rel(API, file)} ${v}`)
    })

    expect(onlyCenter).toEqual([])
  })
})

describe("páginas de servidor con datos: control de acceso", () => {
  const pages = walk(APP, (f) => /[/\\](page|layout)\.tsx$/.test(f))
    .map((file) => ({ key: rel(APP, file), source: readFileSync(file, "utf-8") }))
    .filter(({ source }) => !/^\s*["']use client["']/m.test(source.slice(0, 200)))
    .map(({ key, source }) => ({ key, source: stripComments(source) }))
    .filter(({ source }) => /createServiceClient|createClient\(/.test(source))

  // requireRole([...]) redirige a quien no esté en la lista: solo vale si la lista no incluye al profesorado ni al alumnado
  const requireRoleWithoutTeachers = (source: string) =>
    [...source.matchAll(/requireRole\(\s*\[([^\]]*)\]\s*\)/g)].some((m) => !/"(tutor|alumno)"/.test(m[1]))

  const pageGate = (source: string) =>
    callsScopeGate(source) ||
    requireRoleWithoutTeachers(source) ||
    /\.includes\(\s*profile\.role\s*\)/.test(source) ||
    /!\s*hasFullAccess\(\s*profile\.role\s*\)/.test(source) ||
    /profile\.role\s*!==\s*"superadmin"/.test(source)

  it("encuentra las páginas (guarda contra un análisis vacío)", () => {
    expect(pages.length).toBeGreaterThan(8)
  })

  it("cada página que consulta la base de datos lleva control de acceso o está justificada", () => {
    const missing = pages.filter((p) => !pageGate(p.source) && !(p.key in PAGE_EXCEPTIONS)).map((p) => p.key)

    expect(missing).toEqual([])
  })

  it("las excepciones de páginas existen y siguen sin control propio", () => {
    const byKey = new Map(pages.map((p) => [p.key, p]))

    expect(Object.keys(PAGE_EXCEPTIONS).filter((k) => !byKey.has(k))).toEqual([])
    expect(Object.keys(PAGE_EXCEPTIONS).filter((k) => byKey.has(k) && pageGate(byKey.get(k)!.source))).toEqual([])
  })

  // Las páginas de un proceso no pueden quedarse en "es del centro": o entran por canAccessProcess
  // o son solo para administración/orientación.
  it("las páginas de un proceso comprueban el acceso a ese proceso o son solo de administración/orientación", () => {
    const processPages = pages.filter((p) => p.key.startsWith("(dashboard)/processes/[id]/"))
    expect(processPages.length).toBeGreaterThanOrEqual(6)

    const weak = processPages
      .filter(
        (p) =>
          !calls(p.source, "canAccessProcess") &&
          !/\.includes\(\s*profile\.role\s*\)/.test(p.source) &&
          !/!\s*hasFullAccess\(/.test(p.source)
      )
      .map((p) => p.key)

    expect(weak).toEqual([])
  })

  it("el panel de inicio limita los procesos de un profesor a los suyos", () => {
    const dashboard = join(APP, "(dashboard)", "dashboard", "page.tsx")
    expect(existsSync(dashboard)).toBe(true)
    expect(calls(readCode(dashboard), "getAccessibleProcessIds")).toBe(true)
  })
})
