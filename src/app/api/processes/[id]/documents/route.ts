import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"
import { convertPdfToMarkdown, isMarkitdownAvailable } from "@/lib/markitdown"

type Params = { params: Promise<{ id: string }> }

// GET — list documents for a process
export async function GET(_req: Request, { params }: Params) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("process_documents")
    .select("id, name, original_filename, created_at, created_by")
    .eq("process_id", id)
    .eq("center_id", profile.center_id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ documents: data ?? [] })
}

// POST — upload PDF, convert to markdown, store
export async function POST(req: Request, { params }: Params) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin", "orientador"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  // Verify the process belongs to this center
  const { data: proc } = await supabase
    .from("processes")
    .select("center_id")
    .eq("id", id)
    .single()

  if (!proc || proc.center_id !== profile.center_id) {
    return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const name = (formData.get("name") as string | null) ?? file?.name ?? "Documento"

  if (!file) return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 })
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Solo se admiten archivos PDF" }, { status: 400 })
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "El archivo supera el límite de 20 MB" }, { status: 400 })
  }

  const available = await isMarkitdownAvailable()
  if (!available) {
    return NextResponse.json(
      { error: "markitdown no está disponible en este servidor. Configura MARKITDOWN_BIN." },
      { status: 503 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let markdown: string
  try {
    markdown = await convertPdfToMarkdown(buffer, file.name)
  } catch (err) {
    return NextResponse.json(
      { error: `Error al convertir el PDF: ${(err as Error).message}` },
      { status: 500 }
    )
  }

  if (!markdown || markdown.length < 10) {
    return NextResponse.json(
      { error: "El PDF no contiene texto extraíble. Puede ser un PDF escaneado sin OCR." },
      { status: 422 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc, error: dbErr } = await (supabase as any)
    .from("process_documents")
    .insert({
      process_id: id,
      center_id: profile.center_id,
      name,
      original_filename: file.name,
      content_markdown: markdown,
      created_by: profile.id,
    })
    .select("id, name, original_filename, created_at")
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ document: doc }, { status: 201 })
}
