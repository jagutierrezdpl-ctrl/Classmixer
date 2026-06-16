import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("questionnaire_templates")
    .select("*, questionnaire_template_questions(question_type_id, default_enabled, default_min, default_max, question_types(code, label, category))")
    .or(`center_id.is.null,center_id.eq.${profile.center_id}`)
    .order("is_system", { ascending: false })
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
