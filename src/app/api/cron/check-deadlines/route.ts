import { createServiceClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Called by Vercel Cron (vercel.json) or manually. Requires CRON_SECRET header.
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // Find questionnaire_settings with auto_close_questionnaire=true
  // and deadline in the past, where the process status is still 'cuestionario_abierto'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settings } = await (supabase as any)
    .from("questionnaire_settings")
    .select("process_id, deadline")
    .eq("auto_close_questionnaire", true)
    .lt("deadline", now)
    .not("deadline", "is", null)

  if (!settings || settings.length === 0) {
    return NextResponse.json({ closed: 0 })
  }

  const processIds = settings.map((s: { process_id: string }) => s.process_id)

  // Close only processes that are currently open
  const { data: updated } = await supabase
    .from("processes")
    .update({ status: "cuestionario_cerrado", updated_at: now })
    .in("id", processIds)
    .eq("status", "cuestionario_abierto")
    .select("id, name")

  const count = updated?.length ?? 0
  console.log(`[cron] Closed ${count} questionnaires past deadline`)
  return NextResponse.json({ closed: count, ids: updated?.map((p: { id: string }) => p.id) ?? [] })
}

// Also allow GET for manual testing in dev
export async function GET(request: Request) {
  return POST(request)
}
