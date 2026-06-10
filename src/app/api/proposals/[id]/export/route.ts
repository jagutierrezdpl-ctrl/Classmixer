import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { exportProposalToExcel } from "@/lib/excel/export"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: proposalRaw, error } = await supabase
    .from("proposals")
    .select("*, proposal_assignments(*, students(*))")
    .eq("id", id)
    .single()

  if (error || !proposalRaw) return NextResponse.json({ error: "No encontrada" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proposal = proposalRaw as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const students = (proposal.proposal_assignments ?? []).map((a: any) => a.students).filter(Boolean)
  const buffer = exportProposalToExcel(proposal, students)

  await logAudit(profile.id, profile.center_id, "export_proposal_excel", "proposal", {
    processId: proposal.process_id,
    entityId: id,
  })

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${proposal.name.replace(/\s+/g, "_")}.xlsx"`,
    },
  })
}
