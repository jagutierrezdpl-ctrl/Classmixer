import { createServiceClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { LEGACY_QUESTION_CODES } from "@/lib/questionnaire/catalog"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getActiveAdvancedQuestions(supabase: any, processId: string) {
  const { data } = await supabase
    .from("questionnaire_questions")
    .select("question_type_id, min, max, sort_order, question_types(code, category, label, description, icon, input_mode, sensitivity)")
    .eq("process_id", processId)
    .eq("enabled", true)
    .order("sort_order")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).filter((r: any) => r.question_types && !LEGACY_QUESTION_CODES.includes(r.question_types.code)) as any[]
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createServiceClient()

  const { data: tokenDataRaw, error } = await supabase
    .from("questionnaire_tokens")
    .select("*, students(*), processes(name, questionnaire_settings(*))")
    .eq("token", token)
    .single()

  if (error || !tokenDataRaw) {
    return NextResponse.json({ error: "Enlace no válido o expirado" }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokenData = tokenDataRaw as any

  if (tokenData.used) {
    return NextResponse.json({ error: "Este cuestionario ya ha sido completado" }, { status: 410 })
  }

  const student = tokenData.students
  const process = tokenData.processes
  // questionnaire_settings is a one-to-many join — Supabase returns an array.
  // Normalize to single object so the frontend receives a plain settings object.
  const rawSettings = process?.questionnaire_settings
  const settings = Array.isArray(rawSettings) ? (rawSettings[0] ?? null) : (rawSettings ?? null)

  // Get all active students in the same process (excluding the respondent)
  const { data: allStudents } = await supabase
    .from("students")
    .select("id, first_name, last_name, current_class")
    .eq("process_id", tokenData.process_id)
    .eq("active", true)
    .neq("id", tokenData.student_id)
    .order("last_name")

  const activeAdvanced = await getActiveAdvancedQuestions(supabase, tokenData.process_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const advanced_questions = activeAdvanced.map((r: any) => ({
    code: r.question_types.code,
    category: r.question_types.category,
    label: r.question_types.label,
    description: r.question_types.description,
    icon: r.question_types.icon,
    input_mode: r.question_types.input_mode,
    sensitivity: r.question_types.sensitivity,
    min: r.min ?? 0,
    max: r.max ?? 5,
  }))

  const resolvedSettings = settings ?? {
    friendship_enabled: true,
    friendship_min: 1,
    friendship_max: 5,
    work_enabled: false,
    work_max: 3,
    work_min: 0,
    emotional_enabled: false,
    emotional_max: 3,
    emotional_min: 0,
    negative_enabled: false,
    negative_max: 2,
  }

  // Guarantee minimums: if a question is enabled but min is 0/null, default to 1.
  // This prevents the vacuous-truth canSubmit=true bug when friendship_min=0 is stored in DB.
  if (resolvedSettings.friendship_enabled && (resolvedSettings.friendship_min ?? 0) < 1) {
    resolvedSettings.friendship_min = 1
  }

  return NextResponse.json({
    student_name: `${student.first_name} ${student.last_name}`,
    process_name: process.name,
    settings: resolvedSettings,
    students: allStudents ?? [],
    advanced_questions,
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  // 15 submissions per 10 minutes per IP — enough for a student to retry, blocks bots
  if (!rateLimit(getClientIp(request), 15, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiadas peticiones. Espera unos minutos." }, { status: 429 })
  }

  const { token } = await params
  const supabase = createServiceClient()

  const { data: tokenDataRaw, error } = await supabase
    .from("questionnaire_tokens")
    .select("process_id, student_id, used, processes(questionnaire_settings(*))")
    .eq("token", token)
    .single()

  if (error || !tokenDataRaw) {
    return NextResponse.json({ error: "Enlace no válido" }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokenData = tokenDataRaw as any

  // Read and validate body BEFORE claiming the token, so a student who sends
  // too few selections gets an error and can fix it without losing their token.
  const body = await request.json().catch(() => null)
  const { selections, advanced } = body ?? {}

  if (!selections || typeof selections !== "object") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
  }

  // questionnaire_settings comes as an array from the join — normalize to single object
  const rawSettings = tokenData.processes?.questionnaire_settings
  const settings = (Array.isArray(rawSettings) ? (rawSettings[0] ?? {}) : (rawSettings ?? {}))

  // Validate server-side limits per relation type.
  // Use || instead of ?? for friendship_min: ?? only replaces null/undefined,
  // not 0 — so a DB value of 0 would bypass the validation entirely.
  const limits: Record<string, { enabled: boolean; min: number; max: number }> = {
    friendship: { enabled: settings.friendship_enabled ?? true,  min: settings.friendship_min || 1, max: settings.friendship_max ?? 5 },
    work:       { enabled: settings.work_enabled ?? false,       min: settings.work_min ?? 0,       max: settings.work_max ?? 3 },
    emotional:  { enabled: settings.emotional_enabled ?? false,  min: settings.emotional_min ?? 0,  max: settings.emotional_max ?? 3 },
    negative:   { enabled: settings.negative_enabled ?? false,   min: 0,                            max: settings.negative_max ?? 2 },
  }

  // Enforce minimums server-side — token is NOT consumed if validation fails
  for (const [relationType, limit] of Object.entries(limits)) {
    if (!limit.enabled || limit.min === 0) continue
    const sent = Array.isArray(selections[relationType]) ? (selections[relationType] as string[]).length : 0
    if (sent < limit.min) {
      const labels: Record<string, string> = { friendship: "Amistad", work: "Trabajo", emotional: "Apoyo", negative: "Convivencia" }
      return NextResponse.json(
        { error: `Debes elegir al menos ${limit.min} compañero(s) en "${labels[relationType] ?? relationType}"` },
        { status: 400 }
      )
    }
  }

  // Parse advanced input here — before the token claim — so we can validate minimums
  // without consuming the token on bad requests.
  const advancedInput = advanced && typeof advanced === "object" ? advanced : {}
  const choices = advancedInput.choices && typeof advancedInput.choices === "object" ? advancedInput.choices : {}
  const scales = advancedInput.scales && typeof advancedInput.scales === "object" ? advancedInput.scales : {}
  const climateInput = advancedInput.climate && typeof advancedInput.climate === "object" ? advancedInput.climate : {}
  const metadataByCode = advancedInput.metadata && typeof advancedInput.metadata === "object" ? advancedInput.metadata : {}

  // Load active advanced questions once — reused for validation and for building responseRows.
  const activeAdvanced = await getActiveAdvancedQuestions(supabase, tokenData.process_id)

  // Enforce minimums for advanced questions server-side (token NOT consumed if validation fails)
  for (const r of activeAdvanced) {
    const qt = r.question_types
    const min = r.min ?? 0
    if (min === 0) continue

    if (qt.input_mode === "choice" || qt.input_mode === "scale") {
      const sent = Array.isArray((choices as Record<string, unknown>)[qt.code])
        ? ((choices as Record<string, string[]>)[qt.code]).length
        : 0
      if (sent < min) {
        return NextResponse.json(
          { error: `Debes elegir al menos ${min} compañero(s) en "${qt.label}"` },
          { status: 400 }
        )
      }
    }

    if (qt.input_mode === "climate") {
      const val = Number((climateInput as Record<string, unknown>)[qt.code])
      if (!Number.isInteger(val) || val < 1 || val > 5) {
        return NextResponse.json(
          { error: `Debes valorar "${qt.label}"` },
          { status: 400 }
        )
      }
    }
  }

  // Atomic claim: mark as used only if still unused — prevents double-submission race.
  // Only reached after all validation passes.
  const { data: claimed } = await supabase
    .from("questionnaire_tokens")
    .update({ used: true, completed_at: new Date().toISOString() })
    .eq("token", token)
    .eq("used", false)
    .select("id")
    .single()

  if (!claimed) {
    return NextResponse.json({ error: "Ya completado" }, { status: 410 })
  }

  // Fetch valid student IDs for this process (to prevent injecting arbitrary IDs)
  const { data: validStudents } = await supabase
    .from("students")
    .select("id")
    .eq("process_id", tokenData.process_id)
    .eq("active", true)
    .neq("id", tokenData.student_id)
  const validIds = new Set((validStudents ?? []).map((s: { id: string }) => s.id))

  // Build and validate response rows (cast as any[] because selection_order is a new column not yet in generated types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responseRows: any[] = []
  for (const [relationType, rawIds] of Object.entries(selections)) {
    if (!Array.isArray(rawIds)) continue
    const limit = limits[relationType]
    if (!limit?.enabled) continue // skip disabled question types
    const studentIds = (rawIds as string[])
      .filter(id => typeof id === "string" && validIds.has(id)) // only valid students
      .slice(0, limit.max) // enforce server-side max

    for (let i = 0; i < studentIds.length; i++) {
      const targetId = studentIds[i]
      if (targetId === tokenData.student_id) continue // can't choose yourself
      // weight = max - order (1st choice = max weight, last = 1)
      const selectionOrder = i + 1
      const weight = Math.max(1, limit.max - i)
      responseRows.push({
        process_id: tokenData.process_id,
        respondent_student_id: tokenData.student_id,
        target_student_id: targetId,
        relation_type: relationType,
        selection_order: selectionOrder,
        weight,
      })
    }
  }

  // advancedInput, choices, scales, climateInput, metadataByCode, activeAdvanced — all parsed above before token claim.
  const advancedByCode = new Map(activeAdvanced.map((r) => [r.question_types.code, r]))

  for (const [code, rawIds] of Object.entries(choices as Record<string, unknown>)) {
    const def = advancedByCode.get(code)
    if (!def || def.question_types.input_mode !== "choice" || !Array.isArray(rawIds)) continue
    const max = def.max ?? 5
    const studentIds = (rawIds as unknown[])
      .filter((sid): sid is string => typeof sid === "string" && validIds.has(sid))
      .slice(0, max)

    let meta: Record<string, string> | undefined
    if (def.question_types.category === "bullying") {
      const rawMeta = (metadataByCode as Record<string, unknown>)[code]
      if (rawMeta && typeof rawMeta === "object") {
        const r = rawMeta as Record<string, unknown>
        meta = {}
        if (typeof r.frequency === "string") meta.frequency = r.frequency
        if (typeof r.context === "string") meta.context = r.context
        if (Object.keys(meta).length === 0) meta = undefined
      }
    }

    for (let i = 0; i < studentIds.length; i++) {
      const targetId = studentIds[i]
      if (targetId === tokenData.student_id) continue
      responseRows.push({
        process_id: tokenData.process_id,
        respondent_student_id: tokenData.student_id,
        target_student_id: targetId,
        relation_type: code,
        selection_order: i + 1,
        weight: Math.max(1, max - i),
        ...(meta ? { metadata: meta } : {}),
      })
    }
  }

  for (const [code, valuesRaw] of Object.entries(scales as Record<string, unknown>)) {
    const def = advancedByCode.get(code)
    if (!def || def.question_types.input_mode !== "scale" || !valuesRaw || typeof valuesRaw !== "object") continue
    const max = def.max ?? 5
    const entries = Object.entries(valuesRaw as Record<string, unknown>)
      .filter((entry): entry is [string, number] => validIds.has(entry[0]) && typeof entry[1] === "number" && entry[1] >= 1 && entry[1] <= 5)
      .slice(0, max)
    for (let i = 0; i < entries.length; i++) {
      const [targetId, value] = entries[i]
      if (targetId === tokenData.student_id) continue
      responseRows.push({
        process_id: tokenData.process_id,
        respondent_student_id: tokenData.student_id,
        target_student_id: targetId,
        relation_type: code,
        selection_order: i + 1,
        weight: value,
      })
    }
  }

  if (responseRows.length > 0) {
    const { error: insertError } = await supabase
      .from("responses")
      .insert(responseRows)

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  // Clima de aula: no dirigido a un compañero, va a su propia tabla
  const climateRows: { process_id: string; respondent_student_id: string; question_type_id: string; value: number }[] = []
  for (const [code, rawValue] of Object.entries(climateInput as Record<string, unknown>)) {
    const def = advancedByCode.get(code)
    if (!def || def.question_types.input_mode !== "climate") continue
    const value = Number(rawValue)
    if (!Number.isInteger(value) || value < 1 || value > 5) continue
    climateRows.push({
      process_id: tokenData.process_id,
      respondent_student_id: tokenData.student_id,
      question_type_id: def.question_type_id,
      value,
    })
  }

  if (climateRows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: climateError } = await (supabase as any)
      .from("climate_responses")
      .upsert(climateRows, { onConflict: "process_id,respondent_student_id,question_type_id" })

    if (climateError) {
      return NextResponse.json({ error: climateError.message }, { status: 500 })
    }
  }

  // Token already marked used atomically at the start of this handler

  // Link to student_profile if not already linked
  // Ensures token-based responses are tracked historically, same as Google login
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: studentRow } = await (supabase as any)
    .from("students")
    .select("id, first_name, last_name, email, student_profile_id, processes!inner(center_id)")
    .eq("id", tokenData.student_id)
    .single()

  if (studentRow && !studentRow.student_profile_id) {
    const centerId = studentRow.processes?.center_id
    if (centerId) {
      let profileId: string | null = null

      // 1. Match by email — reliable even with duplicate names
      if (studentRow.email) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: byEmail } = await (supabase as any)
          .from("student_profiles")
          .select("id")
          .eq("center_id", centerId)
          .eq("email", studentRow.email)
          .maybeSingle()
        if (byEmail) profileId = byEmail.id
      }

      // 2. Fallback: match by name only if exactly one result (avoids wrong links with same-name students)
      if (!profileId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: byName } = await (supabase as any)
          .from("student_profiles")
          .select("id")
          .eq("center_id", centerId)
          .eq("first_name", studentRow.first_name)
          .eq("last_name", studentRow.last_name)
        if (byName?.length === 1) profileId = byName[0].id
      }

      if (profileId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("students")
          .update({ student_profile_id: profileId })
          .eq("id", tokenData.student_id)
      }
    }
  }

  return NextResponse.json({ success: true })
}
