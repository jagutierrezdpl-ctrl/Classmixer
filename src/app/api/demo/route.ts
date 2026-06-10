import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

const DEMO_YEAR = "DEMO"

// ── Demo students ─────────────────────────────────────────────────────────────
const STUDENTS = [
  // 6A — 15 alumnos
  { first_name: "Lucía",     last_name: "García Martín",     current_class: "6A", gender: "F", average_grade: 9.1, academic_level: "Alto",        behavior_level: "Positiva",    needs_type: "No" },
  { first_name: "Marcos",    last_name: "López Sánchez",     current_class: "6A", gender: "M", average_grade: 8.5, academic_level: "Alto",        behavior_level: "Positiva",    needs_type: "No" },
  { first_name: "Sara",      last_name: "Fernández Gil",     current_class: "6A", gender: "F", average_grade: 7.2, academic_level: "Medio",       behavior_level: "Normal",      needs_type: "No" },
  { first_name: "Adrián",    last_name: "Ruiz Torres",       current_class: "6A", gender: "M", average_grade: 5.8, academic_level: "Medio-bajo",  behavior_level: "Seguimiento", needs_type: "Refuerzo" },
  { first_name: "Elena",     last_name: "Moreno Castro",     current_class: "6A", gender: "F", average_grade: 8.9, academic_level: "Alto",        behavior_level: "Positiva",    needs_type: "No" },
  { first_name: "Pablo",     last_name: "Jiménez Vega",      current_class: "6A", gender: "M", average_grade: 6.4, academic_level: "Medio",       behavior_level: "Normal",      needs_type: "No" },
  { first_name: "Marta",     last_name: "Díaz Romero",       current_class: "6A", gender: "F", average_grade: 7.8, academic_level: "Medio-alto",  behavior_level: "Normal",      needs_type: "No" },
  { first_name: "Hugo",      last_name: "Álvarez Prieto",    current_class: "6A", gender: "M", average_grade: 4.9, academic_level: "Bajo",        behavior_level: "Conflictiva", needs_type: "NEE" },
  { first_name: "Claudia",   last_name: "González Serrano",  current_class: "6A", gender: "F", average_grade: 8.1, academic_level: "Medio-alto",  behavior_level: "Positiva",    needs_type: "No" },
  { first_name: "Diego",     last_name: "Martínez Blanco",   current_class: "6A", gender: "M", average_grade: 7.5, academic_level: "Medio",       behavior_level: "Normal",      needs_type: "No" },
  { first_name: "Valeria",   last_name: "Hernández Leal",    current_class: "6A", gender: "F", average_grade: 6.9, academic_level: "Medio",       behavior_level: "Normal",      needs_type: "No" },
  { first_name: "Iker",      last_name: "Muñoz Navarro",     current_class: "6A", gender: "M", average_grade: 9.3, academic_level: "Alto",        behavior_level: "Positiva",    needs_type: "Altas capacidades" },
  { first_name: "Noa",       last_name: "Suárez Iglesias",   current_class: "6A", gender: "F", average_grade: 5.1, academic_level: "Bajo",        behavior_level: "Seguimiento", needs_type: "ACNEAE" },
  { first_name: "Mateo",     last_name: "Pérez Soto",        current_class: "6A", gender: "M", average_grade: 7.0, academic_level: "Medio",       behavior_level: "Normal",      needs_type: "No" },
  { first_name: "Alba",      last_name: "Ramos Cano",        current_class: "6A", gender: "F", average_grade: 8.3, academic_level: "Medio-alto",  behavior_level: "Positiva",    needs_type: "No" },
  // 6B — 15 alumnos
  { first_name: "Carlos",    last_name: "Ortega Molina",     current_class: "6B", gender: "M", average_grade: 7.7, academic_level: "Medio-alto",  behavior_level: "Normal",      needs_type: "No" },
  { first_name: "Sofía",     last_name: "Delgado Fuentes",   current_class: "6B", gender: "F", average_grade: 9.0, academic_level: "Alto",        behavior_level: "Positiva",    needs_type: "No" },
  { first_name: "Nicolás",   last_name: "Ramírez Cruz",      current_class: "6B", gender: "M", average_grade: 6.2, academic_level: "Medio",       behavior_level: "Seguimiento", needs_type: "Refuerzo" },
  { first_name: "Daniela",   last_name: "Torres Vargas",     current_class: "6B", gender: "F", average_grade: 8.6, academic_level: "Alto",        behavior_level: "Positiva",    needs_type: "No" },
  { first_name: "Alejandro", last_name: "Flores Ríos",       current_class: "6B", gender: "M", average_grade: 5.5, academic_level: "Medio-bajo",  behavior_level: "Conflictiva", needs_type: "NEE" },
  { first_name: "Carmen",    last_name: "Rubio Peña",        current_class: "6B", gender: "F", average_grade: 7.4, academic_level: "Medio",       behavior_level: "Normal",      needs_type: "No" },
  { first_name: "Gonzalo",   last_name: "Castro Medina",     current_class: "6B", gender: "M", average_grade: 8.0, academic_level: "Medio-alto",  behavior_level: "Normal",      needs_type: "No" },
  { first_name: "Irene",     last_name: "Vargas Herrero",    current_class: "6B", gender: "F", average_grade: 6.7, academic_level: "Medio",       behavior_level: "Normal",      needs_type: "No" },
  { first_name: "Mario",     last_name: "Romero Aguilar",    current_class: "6B", gender: "M", average_grade: 9.5, academic_level: "Alto",        behavior_level: "Positiva",    needs_type: "Altas capacidades" },
  { first_name: "Paula",     last_name: "Serrano Campos",    current_class: "6B", gender: "F", average_grade: 4.8, academic_level: "Bajo",        behavior_level: "Seguimiento", needs_type: "ACNEAE" },
  { first_name: "Javier",    last_name: "Gil Mora",          current_class: "6B", gender: "M", average_grade: 7.1, academic_level: "Medio",       behavior_level: "Normal",      needs_type: "No" },
  { first_name: "Natalia",   last_name: "Vega Santana",      current_class: "6B", gender: "F", average_grade: 8.4, academic_level: "Medio-alto",  behavior_level: "Positiva",    needs_type: "No" },
  { first_name: "Andrés",    last_name: "Guerrero Lara",     current_class: "6B", gender: "M", average_grade: 6.6, academic_level: "Medio",       behavior_level: "Normal",      needs_type: "No" },
  { first_name: "Julia",     last_name: "Domínguez Reyes",   current_class: "6B", gender: "F", average_grade: 5.3, academic_level: "Medio-bajo",  behavior_level: "Normal",      needs_type: "Refuerzo" },
  { first_name: "Samuel",    last_name: "Navarro Ibáñez",    current_class: "6B", gender: "M", average_grade: 7.9, academic_level: "Medio-alto",  behavior_level: "Normal",      needs_type: "No" },
]

// Generate friendship responses: each student picks 3-4 others
// Creates realistic social graph with clusters + isolated students
function buildResponses(students: { id: string; current_class: string }[]) {
  const responses: { respondent_student_id: string; target_student_id: string; relation_type: string; weight: number }[] = []

  const byClass: Record<string, string[]> = {}
  students.forEach(s => {
    if (!byClass[s.current_class]) byClass[s.current_class] = []
    byClass[s.current_class].push(s.id)
  })

  // Social clusters (by index position in students array)
  // Leaders: index 0 (Lucía), 4 (Elena), 15 (Carlos), 16 (Sofía), 23 (Mario)
  // Isolated: index 7 (Hugo), 12 (Noa), 19 (Alejandro), 24 (Paula)

  const isolated = new Set([7, 12, 19, 24]) // these will receive few/no choices

  students.forEach((s, i) => {
    if (isolated.has(i)) return // isolated students don't get many responses sent either

    const classmates = byClass[s.current_class].filter(id => id !== s.id)
    const allOthers = students.map(x => x.id).filter(id => id !== s.id)

    // Pick 2 same-class friends + 1 cross-class
    const picks: string[] = []
    const shuffledClassmates = classmates.sort(() => Math.random() - 0.5).slice(0, 3)
    const shuffledOthers = allOthers.filter(id => !classmates.includes(id)).sort(() => Math.random() - 0.5).slice(0, 1)
    picks.push(...shuffledClassmates, ...shuffledOthers)

    // Leaders get picked more → add extra picks toward index 0, 4, 15, 16, 23
    const leaders = [students[0]?.id, students[4]?.id, students[15]?.id, students[16]?.id, students[23]?.id].filter(Boolean)
    if (!isolated.has(i) && Math.random() > 0.5) {
      const leader = leaders[Math.floor(Math.random() * leaders.length)]
      if (leader && !picks.includes(leader)) picks.push(leader)
    }

    const unique = [...new Set(picks)].slice(0, 4)
    unique.forEach(target => {
      responses.push({ respondent_student_id: s.id, target_student_id: target, relation_type: "friendship", weight: 1 })
    })

    // Work relations (subset)
    if (Math.random() > 0.4) {
      const workTarget = unique[0]
      if (workTarget) {
        responses.push({ respondent_student_id: s.id, target_student_id: workTarget, relation_type: "work", weight: 1 })
      }
    }
  })

  return responses
}

export async function GET() {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()
  const { data } = await db
    .from("processes")
    .select("id, name")
    .eq("center_id", profile.center_id)
    .eq("school_year", DEMO_YEAR)
    .limit(1)
    .single()

  return NextResponse.json({ exists: !!data, processId: data?.id ?? null })
}

export async function POST() {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()

  // Check already exists
  const { data: existing } = await db
    .from("processes")
    .select("id")
    .eq("center_id", profile.center_id)
    .eq("school_year", DEMO_YEAR)
    .limit(1)
    .single()

  if (existing) return NextResponse.json({ processId: existing.id })

  // 1. Create process
  const { data: proc, error: procError } = await db
    .from("processes")
    .insert({
      center_id: profile.center_id,
      created_by: profile.id,
      name: "Demo — Mezcla 6º Primaria a 1º ESO",
      school_year: DEMO_YEAR,
      source_level: "6º Primaria",
      target_level: "1º ESO",
      source_groups: ["6A", "6B"],
      target_groups: ["1A", "1B"],
      status: "propuesta_seleccionada",
    })
    .select()
    .single()

  if (procError || !proc) return NextResponse.json({ error: "Error al crear proceso demo" }, { status: 500 })

  // 2. Questionnaire settings
  await db.from("questionnaire_settings").insert({
    process_id: proc.id,
    friendship_enabled: true,
    friendship_min: 1,
    friendship_max: 5,
    work_enabled: true,
    work_min: 0,
    work_max: 3,
    emotional_enabled: false,
    negative_enabled: false,
    access_mode: "token",
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  })

  // 3. Insert students
  const { data: insertedStudents, error: studErr } = await db
    .from("students")
    .insert(STUDENTS.map((s, i) => ({
      ...s,
      process_id: proc.id,
      active: true,
      external_id: `DEMO-${String(i + 1).padStart(3, "0")}`,
    })))
    .select()

  if (studErr || !insertedStudents) return NextResponse.json({ error: "Error al insertar alumnos" }, { status: 500 })

  // 4. Insert tokens (all completed)
  await db.from("questionnaire_tokens").insert(
    insertedStudents.map(s => ({
      process_id: proc.id,
      student_id: s.id,
      token: `demo-${s.id.slice(0, 8)}`,
      used: true,
      completed_at: new Date().toISOString(),
    }))
  )

  // 5. Build and insert responses
  const responses = buildResponses(insertedStudents.map(s => ({ id: s.id, current_class: s.current_class })))
  if (responses.length > 0) {
    await db.from("responses").insert(responses.map(r => ({ ...r, process_id: proc.id })))
  }

  // 6. Rules
  const getIdx = (name: string) => insertedStudents.find(s => s.first_name === name)
  const hugo = getIdx("Hugo")
  const alejandro = getIdx("Alejandro")
  const noa = getIdx("Noa")
  const lucia = getIdx("Lucía")
  const mario = getIdx("Mario")

  const rulesToInsert = [
    { rule_type: "must_separate",     priority: "obligatoria", description: "Historial de conflictos graves entre clase",      students: [hugo?.id, alejandro?.id].filter((x): x is string => !!x) },
    { rule_type: "protect_vulnerable", priority: "alta",       description: "Noa solo tiene relación con Lucía, mantener juntas", students: [noa?.id, lucia?.id].filter((x): x is string => !!x) },
    { rule_type: "must_separate",     priority: "media",       description: "Separar líderes de sus grupos para equilibrar",    students: [lucia?.id, mario?.id].filter((x): x is string => !!x) },
  ]

  for (const rule of rulesToInsert) {
    if (rule.students.length < 2) continue
    const { data: ruleRow } = await db.from("rules").insert({
      process_id: proc.id,
      rule_type: rule.rule_type,
      priority: rule.priority,
      description: rule.description,
      created_by: profile.id,
      active: true,
    }).select().single()

    if (ruleRow) {
      await db.from("rule_students").insert(
        rule.students.map(sid => ({ rule_id: ruleRow.id, student_id: sid }))
      )
    }
  }

  // 7. Proposals — Propuesta A (aprobada)
  const half = Math.ceil(insertedStudents.length / 2)
  const classA = insertedStudents.slice(0, half).map(s => s.id)
  const classB = insertedStudents.slice(half).map(s => s.id)

  const { data: propA } = await db.from("proposals").insert({
    process_id: proc.id,
    name: "Propuesta A",
    score_total: 88.4,
    score_social: 91.2,
    score_academic: 87.6,
    score_gender: 84.0,
    score_behavior: 90.1,
    status: "aprobada",
    generated_at: new Date().toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).select().single()

  if (propA) {
    await db.from("proposal_assignments").insert([
      ...classA.map(sid => ({ proposal_id: propA.id, student_id: sid, target_class: "1A" })),
      ...classB.map(sid => ({ proposal_id: propA.id, student_id: sid, target_class: "1B" })),
    ])

    const gradeA = classA.map(id => insertedStudents.find(s => s.id === id)?.average_grade ?? 7).reduce((a, b) => a + b, 0) / classA.length
    const gradeB = classB.map(id => insertedStudents.find(s => s.id === id)?.average_grade ?? 7).reduce((a, b) => a + b, 0) / classB.length

    await db.from("proposal_metrics").insert([
      { proposal_id: propA.id, target_class: "1A", metric_key: "count", metric_value: classA.length },
      { proposal_id: propA.id, target_class: "1A", metric_key: "avg_grade", metric_value: Math.round(gradeA * 10) / 10 },
      { proposal_id: propA.id, target_class: "1A", metric_key: "girls", metric_value: classA.filter(id => insertedStudents.find(s => s.id === id)?.gender === "F").length },
      { proposal_id: propA.id, target_class: "1A", metric_key: "boys", metric_value: classA.filter(id => insertedStudents.find(s => s.id === id)?.gender === "M").length },
      { proposal_id: propA.id, target_class: "1A", metric_key: "students_with_friend", metric_value: Math.round(classA.length * 0.87) },
      { proposal_id: propA.id, target_class: "1A", metric_key: "reciprocal_preserved", metric_value: 7 },
      { proposal_id: propA.id, target_class: "1A", metric_key: "isolated_count", metric_value: 1 },
      { proposal_id: propA.id, target_class: "1B", metric_key: "count", metric_value: classB.length },
      { proposal_id: propA.id, target_class: "1B", metric_key: "avg_grade", metric_value: Math.round(gradeB * 10) / 10 },
      { proposal_id: propA.id, target_class: "1B", metric_key: "girls", metric_value: classB.filter(id => insertedStudents.find(s => s.id === id)?.gender === "F").length },
      { proposal_id: propA.id, target_class: "1B", metric_key: "boys", metric_value: classB.filter(id => insertedStudents.find(s => s.id === id)?.gender === "M").length },
      { proposal_id: propA.id, target_class: "1B", metric_key: "students_with_friend", metric_value: Math.round(classB.length * 0.93) },
      { proposal_id: propA.id, target_class: "1B", metric_key: "reciprocal_preserved", metric_value: 8 },
      { proposal_id: propA.id, target_class: "1B", metric_key: "isolated_count", metric_value: 0 },
    ])
  }

  // Propuesta B (sin aprobar)
  const { data: propB } = await db.from("proposals").insert({
    process_id: proc.id,
    name: "Propuesta B",
    score_total: 82.1,
    score_social: 85.0,
    score_academic: 83.4,
    score_gender: 79.5,
    score_behavior: 80.6,
    status: "generada",
    generated_at: new Date().toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).select().single()

  if (propB) {
    // Slightly different distribution for B
    const classA2 = [...insertedStudents].sort(() => Math.random() - 0.5).slice(0, half).map(s => s.id)
    const classB2 = insertedStudents.map(s => s.id).filter(id => !classA2.includes(id))
    await db.from("proposal_assignments").insert([
      ...classA2.map(sid => ({ proposal_id: propB.id, student_id: sid, target_class: "1A" })),
      ...classB2.map(sid => ({ proposal_id: propB.id, student_id: sid, target_class: "1B" })),
    ])
  }

  // 8. Sociogram metrics
  const metricsToInsert = insertedStudents.map((s, i) => {
    const isolated = [7, 12, 19, 24].includes(i)
    const leader = [0, 4, 15, 16, 23].includes(i)
    return {
      process_id: proc.id,
      student_id: s.id,
      received_count: isolated ? 0 : leader ? 8 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 4),
      given_count: isolated ? 1 : 3 + Math.floor(Math.random() * 2),
      reciprocal_count: isolated ? 0 : leader ? 3 : 1 + Math.floor(Math.random() * 3),
      centrality: isolated ? 0.01 : leader ? 0.7 + Math.random() * 0.3 : 0.1 + Math.random() * 0.4,
      betweenness: isolated ? 0 : leader ? 0.3 + Math.random() * 0.2 : Math.random() * 0.15,
      isolation_score: isolated ? 0.9 : leader ? 0.0 : Math.random() * 0.3,
      community_id: isolated ? 99 : leader ? Math.floor(i / 8) : Math.floor(i / 5),
    }
  })

  await db.from("sociogram_metrics").insert(metricsToInsert)

  return NextResponse.json({ processId: proc.id }, { status: 201 })
}

export async function DELETE() {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const db = createServiceClient()

  const { data: demoProcesses } = await db
    .from("processes")
    .select("id")
    .eq("center_id", profile.center_id)
    .eq("school_year", DEMO_YEAR)

  if (!demoProcesses?.length) return NextResponse.json({ ok: true })

  const ids = demoProcesses.map(p => p.id)

  // Cascade deletes happen via DB constraints; just delete the processes
  await db.from("processes").delete().in("id", ids)

  return NextResponse.json({ ok: true })
}
