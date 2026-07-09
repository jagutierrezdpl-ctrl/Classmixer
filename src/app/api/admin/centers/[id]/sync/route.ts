import { getUserProfile } from "@/lib/auth"
import { syncCenter } from "@/lib/eduplataforma/sync"
import { NextResponse } from "next/server"

// POST /api/admin/centers/[id]/sync — sincroniza personal/alumnado/grupos desde
// EduPlataforma bajo demanda (superadmin), sin esperar el cooldown de 15 min del login SSO.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getUserProfile()
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params

  try {
    const result = await syncCenter(id)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al sincronizar" },
      { status: 500 }
    )
  }
}
