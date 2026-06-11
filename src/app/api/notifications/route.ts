import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const supabase = createServiceClient()

  // Get all active process IDs for this center
  const { data: processes } = await supabase
    .from("processes")
    .select("id, status")
    .eq("center_id", profile.center_id)
    .not("status", "in", '("archivado","cerrado")')

  if (!processes || processes.length === 0) {
    return NextResponse.json({ pending_tokens: 0, pending_proposals: 0, total: 0 })
  }

  // Count pending tokens (questionnaire open + not completed)
  const openProcessIds = processes
    .filter(p => p.status === "cuestionario_abierto")
    .map(p => p.id)

  let pendingTokens = 0
  if (openProcessIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from("questionnaire_tokens")
      .select("id", { count: "exact", head: true })
      .in("process_id", openProcessIds)
      .is("completed_at", null)
    pendingTokens = count ?? 0
  }

  // Count processes with generated proposals not yet approved
  const pendingProposals = processes.filter(
    p => p.status === "propuestas_generadas"
  ).length

  const total = (pendingTokens > 0 ? 1 : 0) + pendingProposals

  return NextResponse.json({
    pending_tokens: pendingTokens,
    pending_proposals: pendingProposals,
    total,
    process_ids_with_proposals: processes
      .filter(p => p.status === "propuestas_generadas")
      .map(p => p.id),
  }, {
    headers: { "Cache-Control": "no-store" },
  })
}
