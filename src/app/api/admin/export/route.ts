import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"
import ExcelJS from "exceljs"

export async function GET() {
  const profile = await getUserProfile()
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: centers } = await supabase
    .from("centers")
    .select("*")
    .order("created_at", { ascending: true })

  const centerIds = (centers ?? []).map(c => c.id)
  const safeIds = centerIds.length > 0 ? centerIds : ["__none__"]

  const [{ data: userCounts }, { data: processCounts }, { data: licenses }] = await Promise.all([
    supabase.from("users").select("center_id").in("center_id", safeIds),
    supabase.from("processes").select("center_id").in("center_id", safeIds),
    supabase.from("licenses").select("center_id, plan, active").in("center_id", safeIds),
  ])

  const userMap: Record<string, number> = {}
  const processMap: Record<string, number> = {}
  const licenseMap: Record<string, string> = {}

  for (const u of (userCounts ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cid = (u as any).center_id
    userMap[cid] = (userMap[cid] ?? 0) + 1
  }
  for (const p of (processCounts ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cid = (p as any).center_id
    processMap[cid] = (processMap[cid] ?? 0) + 1
  }
  for (const l of (licenses ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cid = (l as any).center_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    licenseMap[cid] = (l as any).plan ?? "free"
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "ClassMixer"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Centros")

  sheet.columns = [
    { header: "Nombre", key: "name", width: 35 },
    { header: "Ciudad", key: "city", width: 20 },
    { header: "Dirección", key: "address", width: 30 },
    { header: "País", key: "country", width: 15 },
    { header: "Plan", key: "plan", width: 12 },
    { header: "Usuarios", key: "users", width: 12 },
    { header: "Procesos", key: "processes", width: 12 },
    { header: "Creado", key: "created_at", width: 18 },
  ]

  // Style header row
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, size: 11 }
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } }
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
  headerRow.alignment = { vertical: "middle" }
  headerRow.height = 22

  for (const c of (centers ?? [])) {
    sheet.addRow({
      name: c.name,
      city: c.city ?? "",
      address: c.address ?? "",
      country: c.country ?? "",
      plan: licenseMap[c.id] ?? "free",
      users: userMap[c.id] ?? 0,
      processes: processMap[c.id] ?? 0,
      created_at: new Date(c.created_at).toLocaleDateString("es-ES"),
    })
  }

  // Alternate row colors
  sheet.eachRow((row, i) => {
    if (i === 1) return
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: i % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" },
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="classmixer-centros-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
