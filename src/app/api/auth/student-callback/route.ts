import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const ALLOWED_DOMAIN = process.env.STUDENT_EMAIL_DOMAIN ?? process.env.NEXT_PUBLIC_GOOGLE_HD_DOMAIN ?? null

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(`${origin}/q?error=auth_failed`)
  }

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !user?.email) {
    return NextResponse.redirect(`${origin}/q?error=auth_failed`)
  }

  // Validate school domain
  const emailDomain = user.email.split("@")[1]
  if (ALLOWED_DOMAIN && emailDomain !== ALLOWED_DOMAIN) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/q?error=domain_not_allowed`)
  }

  const service = createServiceClient()

  // If this is a staff member, let them through to the dashboard
  const { data: staffProfile } = await service
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()

  if (staffProfile) {
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  // Find student profile by email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: studentProfile } = await (service as any)
    .from("student_profiles")
    .select("id, center_id")
    .eq("email", user.email)
    .maybeSingle()

  if (!studentProfile) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/q?error=not_registered`)
  }

  // Store google_id for future reference
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (service as any)
    .from("student_profiles")
    .update({ google_id: user.id })
    .eq("id", studentProfile.id)

  // Find students records for this profile in open processes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: studentRecords } = await (service as any)
    .from("students")
    .select("id, process_id")
    .eq("student_profile_id", studentProfile.id)
    .eq("active", true)

  if (!studentRecords || studentRecords.length === 0) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/q?error=no_questionnaire`)
  }

  // Filter to only open processes
  const processIds = studentRecords.map((s: { process_id: string }) => s.process_id)
  const { data: openProcesses } = await service
    .from("processes")
    .select("id")
    .in("id", processIds)
    .eq("status", "cuestionario_abierto")

  const openIds = new Set((openProcesses ?? []).map((p: { id: string }) => p.id))
  const openStudentIds = studentRecords
    .filter((s: { process_id: string }) => openIds.has(s.process_id))
    .map((s: { id: string }) => s.id)

  if (openStudentIds.length === 0) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/q?error=no_questionnaire`)
  }

  // Find pending tokens for those students
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingTokens } = await (service as any)
    .from("questionnaire_tokens")
    .select("token")
    .in("student_id", openStudentIds)
    .is("completed_at", null)
    .limit(5)

  // Sign out — students don't get a dashboard session
  await supabase.auth.signOut()

  if (!pendingTokens || pendingTokens.length === 0) {
    return NextResponse.redirect(`${origin}/q?error=no_questionnaire`)
  }

  if (pendingTokens.length === 1) {
    return NextResponse.redirect(`${origin}/q/${pendingTokens[0].token}`)
  }

  // Multiple questionnaires → selection page
  const tokenList = (pendingTokens as { token: string }[]).map(t => t.token).join(",")
  return NextResponse.redirect(`${origin}/q/select?tokens=${tokenList}`)
}
