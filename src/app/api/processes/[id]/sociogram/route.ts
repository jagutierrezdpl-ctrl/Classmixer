import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"
import { calculateSociogram } from "@/lib/sociogram/calculate"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const [{ data: students }, { data: responses }] = await Promise.all([
    supabase.from("students").select("*").eq("process_id", id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", id),
  ])

  if (!students) return NextResponse.json({ error: "Error al cargar alumnos" }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sociogram = calculateSociogram(students as any, (responses ?? []) as any)
  return NextResponse.json(sociogram)
}
