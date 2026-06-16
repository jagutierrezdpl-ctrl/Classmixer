const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-haiku"

export async function generateAISummary(prompt: string, openrouterApiKey?: string | null): Promise<string> {
  if (openrouterApiKey) return generateWithOpenRouter(prompt, openrouterApiKey)
  return generateWithAnthropic(prompt)
}

async function generateWithAnthropic(prompt: string): Promise<string> {
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
      max_tokens: 600,
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

async function generateWithOpenRouter(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Error OpenRouter API: ${response.status} ${err}`)
  }

  const json = await response.json()
  return json.choices?.[0]?.message?.content ?? ""
}
