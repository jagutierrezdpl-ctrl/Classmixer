import { getUserProfile, hasFullAccess } from "@/lib/auth"
import { NextResponse } from "next/server"
import { generateProposedRules } from "@/lib/services/rule-proposal"
import type { UserRole } from "@/types"
import { createServiceClient } from "@/lib/supabase/server"

export type { ProposedRule } from "@/lib/services/rule-proposal"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!hasFullAccess(profile.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("center_id")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()

  if (!process) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const proposals = await generateProposedRules(id, profile.center_id, profile.role as UserRole)
  return NextResponse.json(proposals)
}
