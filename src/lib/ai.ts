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
  systemPrompt?: string
): Promise<string> {
  const system = systemPrompt ?? SOCIOMETRY_SYSTEM_PROMPT
  if (openrouterApiKey) return generateWithOpenRouter(prompt, openrouterApiKey, system)
  return generateWithAnthropic(prompt, system)
}

async function generateWithAnthropic(prompt: string, system: string): Promise<string> {
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
      max_tokens: 800,
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

async function generateWithOpenRouter(prompt: string, apiKey: string, system: string): Promise<string> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: 800,
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
