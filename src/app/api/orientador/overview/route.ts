import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin", "orientador"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: all, error } = await (supabase as any)
    .from("student_profiles")
    .select("id, first_name, last_name, external_id, current_class, gender, behavior_level, needs_type, active, observations")
    .eq("center_id", profile.center_id)
    .order("last_name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const students = all ?? []

  const behavior_alert = students.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any) => s.active !== false && (s.behavior_level === "Seguimiento" || s.behavior_level === "Conflictiva")
  )
  const needs_alert = students.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any) => s.active !== false && s.needs_type && s.needs_type !== "No" && s.needs_type !== ""
  )
  const no_class = students.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any) => s.active !== false && !s.current_class
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inactive = students.filter((s: any) => s.active === false)

  return NextResponse.json({
    behavior_alert,
    needs_alert,
    no_class,
    inactive,
    totals: {
      active: students.filter((s: any) => s.active !== false).length, // eslint-disable-line @typescript-eslint/no-explicit-any
      behavior_alert: behavior_alert.length,
      needs_alert: needs_alert.length,
      no_class: no_class.length,
      inactive: inactive.length,
    },
  })
}
