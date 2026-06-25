const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001"
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-4-5-20251001"

// Scientific framework embedded as system context so every AI call is grounded
// in sociometric methodology (CDC + CIVSOC) without requiring document uploads.
export const SOCIOMETRY_SYSTEM_PROMPT = `Eres un experto en sociometría escolar aplicada. Tu marco de referencia científico es:

CLASIFICACIÓN SOCIOMÉTRICA CDC (Coie, Dodge & Coppotelli, 1982):
Variables base:
  LM = nominaciones positivas recibidas (elecciones de amistad)
  LL = nominaciones negativas recibidas (elecciones de dificultad/rechazo)
  SP = zLM − zLL  (Preferencia Social — cuánto se prefiere al alumno)
  SI = zLM + zLL  (Impacto Social — cuánto se le conoce, positiva o negativamente)
  zSP y zSI son los z-scores restandarizados de SP y SI respectivamente.

Criterios de clasificación:
  • Popular:       zSP > 1,0  y  zLM > 0  (y zLL < 0 si hay datos de rechazo)
  • Rechazado:     zSP < −1,0 y  zLM < 0  y  zLL > 0  [solo si hay nominaciones negativas]
  • Ignorado:      zSI < −1,0 y  zLM < 0  — alumno invisible, ni elegido ni rechazado
  • Controvertido: zSI > 1,0  y  zLM > 0  y  zLL > 0  — líder polarizador
  • Promedio:      |zSP| ≤ 0,5 y |zSI| ≤ 0,5

ÍNDICES GRUPALES CIVSOC (Fernández-Ballesteros, 1995):
  • CG — Cohesión Grupal (IAg): pares_recíprocos / [N(N−1)/2]
      <5% = baja | 5–15% = moderada | >15% = alta
  • DG — Disociación Grupal: pares_rechazo_mutuo / [N(N−1)/2]
  • CoG — Coherencia Grupal: nominaciones_recíprocas / total_nominaciones_dadas
  • IG — Intensidad Grupal: (elecciones_positivas + negativas) / N

PRIORIDADES DE INTERVENCIÓN (de mayor a menor urgencia):
  1. Rechazados (zSP < −1 y zLL > 0): riesgo activo de acoso o conflicto severo. Protocolo diferente al aislado.
  2. Ignorados / Aislados (zSI < −1, 0 nominaciones recibidas): exclusión pasiva, invisibilidad social.
  3. Vulnerables: única relación recíproca; si se rompe al mezclar clases, caen en aislamiento inmediato.
  4. Subgrupos cerrados: >50% vínculos internos, riesgo de endogamia social y exclusión de externos.
  5. Controvertidos: alto impacto polarizador; no más de uno por clase nueva.
  6. Populares prosociales: distribuidores de cohesión; al menos uno por clase nueva.
  7. Alumnos puente (alta intermediación): conectores entre comunidades; distribuir en clases distintas.

IMPORTANTE: Un alumno ignorado NO es lo mismo que uno rechazado. El ignorado requiere inclusión gradual; el rechazado requiere intervención en conflicto. No confundir ni usar los términos intercambiablemente.`

export async function generateAISummary(
  prompt: string,
  openrouterApiKey?: string | null,
  systemPrompt?: string,
  model?: string | null
): Promise<string> {
  const system = systemPrompt ?? SOCIOMETRY_SYSTEM_PROMPT
  if (openrouterApiKey) return generateWithOpenRouter(prompt, openrouterApiKey, system, model)
  return generateWithAnthropic(prompt, system)
}

async function generateWithAnthropic(prompt: string, system: string, maxTokens = 800): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("IA no disponible: configura una clave de OpenRouter en Configuración del centro, o ANTHROPIC_API_KEY en el servidor")
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Error Anthropic API: ${response.status} ${err}`)
  }

  const json = await response.json()
  return json.content?.[0]?.text ?? ""
}

async function generateWithOpenRouter(prompt: string, apiKey: string, system: string, model?: string | null, maxTokens = 800): Promise<string> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model ?? OPENROUTER_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Error OpenRouter API: ${response.status} ${err}`)
  }

  const json = await response.json()
  return json.choices?.[0]?.message?.content ?? ""
}

// ── AI-based class mixing ────────────────────────────────────────────────────

export interface StudentInfoForMix {
  id: string
  name: string
  current_class: string
  gender: string
  average_grade: number
  behavior_level?: string
  needs_type?: string
}

export interface ChoiceInfoForMix {
  from_name: string
  to_name: string
  relation_type: string
}

export interface RuleInfoForMix {
  rule_type: string
  description?: string
  student_names: string[]
  target_class?: string
  max_count?: number
}

export interface AIMixProposal {
  name: string
  assignments: Record<string, string>
  rationale: string
}

function buildMixPrompt(
  students: StudentInfoForMix[],
  choices: ChoiceInfoForMix[],
  rules: RuleInfoForMix[],
  targetClasses: string[],
  numProposals: number,
  instructions?: string
): string {
  const studentLines = students.map(s =>
    `${s.id} | ${s.name} | ${s.current_class} | ${s.gender} | ${s.average_grade.toFixed(1)} | ${s.behavior_level ?? "Normal"} | ${s.needs_type ?? "No"}`
  ).join("\n")

  const typeLabel: Record<string, string> = { friendship: "amistad", work: "trabajo", emotional: "apoyo emocional" }
  const choiceLines = choices
    .map(c => `${c.from_name} → ${c.to_name} (${typeLabel[c.relation_type] ?? c.relation_type})`)
    .join("\n")

  const ruleTypeLabel: Record<string, string> = {
    must_separate: "SEPARAR OBLIGATORIAMENTE",
    must_keep_together: "JUNTAR OBLIGATORIAMENTE",
    should_keep_together: "INTENTAR JUNTAR",
    lock_student_to_class: "FIJAR EN CLASE",
    max_from_group: "MÁXIMO POR CLASE",
    protect_vulnerable: "PROTEGER (garantizar un amigo)",
    avoid_tutor: "EVITAR TUTOR EN CLASE",
  }
  const ruleLines = rules.map(r => {
    const label = ruleTypeLabel[r.rule_type] ?? r.rule_type
    const names = r.student_names.join(", ")
    const extra = r.target_class ? ` → ${r.target_class}` : r.max_count ? ` (máx. ${r.max_count})` : ""
    const reason = r.description ? ` [${r.description}]` : ""
    return `${label}: ${names}${extra}${reason}`
  }).join("\n")

  return `Crea ${numProposals} propuesta${numProposals > 1 ? "s DISTINTAS" : ""} de distribución de ${students.length} alumnos en ${targetClasses.length} clases (${targetClasses.join(", ")}).
Responde SOLO con JSON válido, sin texto adicional fuera del JSON.

ALUMNOS (ID | nombre | clase_origen | género | nota | conducta | NEE):
${studentLines}

ELECCIONES SOCIOMÉTRICAS:
${choiceLines || "Sin datos de cuestionario"}

REGLAS${rules.length ? "" : ": Ninguna"}:
${ruleLines || ""}
${instructions ? `\nINSTRUCCIONES DEL EQUIPO DOCENTE:\n${instructions}\n` : ""}
CRITERIOS:
- Respetar ESTRICTAMENTE las reglas "SEPARAR" y "FIJAR"
- Equilibrar nota media entre clases
- Equilibrar género entre clases
- Mezclar clases de origen (evitar que toda una clase vaya junta)
- Mantener al menos un amigo elegido por alumno cuando sea posible
- Distribuir alumnos con NEE y conducta de seguimiento entre clases
${numProposals > 1 ? `- Las ${numProposals} propuestas deben ser DIFERENTES entre sí\n` : ""}
Todos los alumnos deben aparecer asignados a una clase. Usa exactamente estos nombres de clase: ${targetClasses.join(", ")}.

JSON de respuesta:
{
  "proposals": [
    {
      "name": "Propuesta A",
      "assignments": { "ID_ALUMNO": "CLASE", ... },
      "rationale": "Explicación breve en español (máx. 120 palabras)"
    }
  ]
}`
}

export async function generateAIMixProposals(
  students: StudentInfoForMix[],
  choices: ChoiceInfoForMix[],
  rules: RuleInfoForMix[],
  targetClasses: string[],
  numProposals: number,
  instructions?: string,
  openrouterApiKey?: string | null,
  model?: string | null
): Promise<AIMixProposal[]> {
  const MAX_TOKENS = 6000
  const prompt = buildMixPrompt(students, choices, rules, targetClasses, numProposals, instructions)
  const system = "Eres un experto en distribución y mezcla de clases escolares. Responde SIEMPRE con JSON válido y sin ningún texto fuera del JSON."

  const raw = openrouterApiKey
    ? await generateWithOpenRouter(prompt, openrouterApiKey, system, model, MAX_TOKENS)
    : await generateWithAnthropic(prompt, system, MAX_TOKENS)

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("La IA no devolvió un JSON válido")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed: { proposals?: any[] } = JSON.parse(jsonMatch[0])
  if (!parsed.proposals || !Array.isArray(parsed.proposals)) throw new Error("Formato de respuesta IA inválido")

  return parsed.proposals.map((p, i) => ({
    name: typeof p.name === "string" ? p.name : `Propuesta ${String.fromCharCode(65 + i)}`,
    assignments: p.assignments && typeof p.assignments === "object" ? p.assignments : {},
    rationale: typeof p.rationale === "string" ? p.rationale : "",
  }))
}
