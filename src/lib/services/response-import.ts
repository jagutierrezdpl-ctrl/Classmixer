import { createServiceClient } from "@/lib/supabase/server"
import { randomBytes } from "crypto"

export interface StudentRow {
  id: string
  first_name: string | null
  last_name: string | null
  external_id: string | null
  student_profile_id: string | null
}

export type StudentLookup = {
  byProfileId: Map<string, string>
  byExternalId: Map<string, string>
  byName: Map<string, string>
}

export type MappedResponse = {
  process_id: string
  respondent_student_id: string
  target_student_id: string
  relation_type: string
  weight: number | null
}

function generateToken() {
  return randomBytes(20).toString("hex")
}

function normalizedName(s: StudentRow): string {
  return `${(s.first_name ?? "").toLowerCase()} ${(s.last_name ?? "").toLowerCase()}`.trim()
}

export function buildStudentLookup(students: StudentRow[]): StudentLookup {
  const byProfileId = new Map<string, string>()
  const byExternalId = new Map<string, string>()
  const byName = new Map<string, string>()

  for (const s of students) {
    if (s.student_profile_id) byProfileId.set(s.student_profile_id, s.id)
    if (s.external_id) byExternalId.set(s.external_id, s.id)
    byName.set(normalizedName(s), s.id)
  }

  return { byProfileId, byExternalId, byName }
}

export function mapSourceToTarget(
  sourceStudents: StudentRow[],
  lookup: StudentLookup,
): Map<string, string> {
  const sourceToTarget = new Map<string, string>()

  for (const s of sourceStudents) {
    let targetId: string | undefined
    if (s.student_profile_id) targetId = lookup.byProfileId.get(s.student_profile_id)
    if (!targetId && s.external_id) targetId = lookup.byExternalId.get(s.external_id)
    if (!targetId) targetId = lookup.byName.get(normalizedName(s))
    if (targetId) sourceToTarget.set(s.id, targetId)
  }

  return sourceToTarget
}

export function remapResponses(
  sourceResponses: {
    respondent_student_id: string
    target_student_id: string
    relation_type: string
    weight: number | null
  }[],
  sourceToTarget: Map<string, string>,
  targetProcessId: string,
): MappedResponse[] {
  const mapped: MappedResponse[] = []

  for (const r of sourceResponses) {
    const newRespondent = sourceToTarget.get(r.respondent_student_id)
    const newTarget = sourceToTarget.get(r.target_student_id)
    if (newRespondent && newTarget) {
      mapped.push({
        process_id: targetProcessId,
        respondent_student_id: newRespondent,
        target_student_id: newTarget,
        relation_type: r.relation_type,
        weight: r.weight,
      })
    }
  }

  return mapped
}

export async function persistImport(
  supabase: ReturnType<typeof createServiceClient>,
  targetProcessId: string,
  mapped: MappedResponse[],
): Promise<number> {
  // 1. Delete existing responses to avoid duplicates
  await supabase.from("responses").delete().eq("process_id", targetProcessId)

  // 2. Insert remapped responses in batches of 500
  const BATCH = 500
  let inserted = 0
  for (let i = 0; i < mapped.length; i += BATCH) {
    const batch = mapped.slice(i, i + BATCH)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("responses").insert(batch)
    if (!error) inserted += batch.length
  }

  // 3. Ensure questionnaire_tokens exist for respondents (create missing, mark all used)
  const respondentIds = [...new Set(mapped.map(r => r.respondent_student_id))]
  if (respondentIds.length > 0) {
    const now = new Date().toISOString()

    const { data: existingTokens } = await supabase
      .from("questionnaire_tokens")
      .select("student_id")
      .eq("process_id", targetProcessId)
      .in("student_id", respondentIds)

    const alreadyHaveToken = new Set((existingTokens ?? []).map(t => t.student_id))
    const missingIds = respondentIds.filter(sid => !alreadyHaveToken.has(sid))

    if (alreadyHaveToken.size > 0) {
      await supabase
        .from("questionnaire_tokens")
        .update({ used: true, completed_at: now })
        .eq("process_id", targetProcessId)
        .in("student_id", respondentIds)
    }

    if (missingIds.length > 0) {
      await supabase.from("questionnaire_tokens").insert(
        missingIds.map(sid => ({
          process_id: targetProcessId,
          student_id: sid,
          token: generateToken(),
          used: true,
          completed_at: now,
        }))
      )
    }
  }

  // 4. Advance process status if still in early state
  const { data: proc } = await supabase
    .from("processes")
    .select("status")
    .eq("id", targetProcessId)
    .single()
  if (proc && ["borrador", "cuestionario_abierto"].includes(proc.status)) {
    await supabase
      .from("processes")
      .update({ status: "cuestionario_cerrado" })
      .eq("id", targetProcessId)
  }

  return inserted
}
