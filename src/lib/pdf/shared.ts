import React from "react"
import { StyleSheet, View, Text, Image } from "@react-pdf/renderer"

export const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1e293b" },
  header: { marginBottom: 24 },
  logoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  centerLogo: { width: 72, height: 36, objectFit: "contain" },
  classmixerBrand: { fontSize: 13, fontWeight: "bold", color: "#1e40af" },
  classmixerSub: { fontSize: 7, color: "#94a3b8", textAlign: "right", marginTop: 1 },
  title: { fontSize: 20, fontWeight: "bold", color: "#1e40af", marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#64748b" },
  metaRow: { flexDirection: "row", gap: 16, marginTop: 8 },
  metaBadge: { backgroundColor: "#eff6ff", padding: "4 8", borderRadius: 4, fontSize: 9, color: "#1e40af" },
  confidentialBadge: { backgroundColor: "#fef2f2", padding: "4 8", borderRadius: 4, fontSize: 9, color: "#b91c1c" },
  sectionTitle: { fontSize: 13, fontWeight: "bold", color: "#1e293b", marginBottom: 8, marginTop: 16, borderBottom: "1pt solid #e2e8f0", paddingBottom: 4 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, minWidth: "22%", backgroundColor: "#f8fafc", border: "1pt solid #e2e8f0", borderRadius: 6, padding: "8 10" },
  summaryValue: { fontSize: 18, fontWeight: "bold", color: "#1e40af" },
  summaryLabel: { fontSize: 8, color: "#64748b", marginTop: 2 },
  tableHeader: { flexDirection: "row", borderBottom: "1pt solid #e2e8f0", paddingBottom: 4, marginBottom: 4, marginTop: 6 },
  thCell: { fontSize: 8, fontWeight: "bold", color: "#64748b", textTransform: "uppercase" },
  // alignItems: "flex-start" ensures cells are top-aligned when one cell wraps
  // to multiple lines (prevents the row-height misalignment / cell-merge bug)
  tableRow: { flexDirection: "row", paddingVertical: 3, borderBottom: "0.5pt solid #f1f5f9", alignItems: "flex-start" },
  tdCell: { fontSize: 9, color: "#334155" },
  card: { marginBottom: 14, border: "1pt solid #e2e8f0", borderRadius: 6, padding: 12 },
  cardTitle: { fontSize: 11, fontWeight: "bold", color: "#1e293b", marginBottom: 6 },
  alertHigh: { backgroundColor: "#fef2f2", borderLeft: "3pt solid #dc2626", padding: 8, marginBottom: 6, borderRadius: 3 },
  alertMedium: { backgroundColor: "#fffbeb", borderLeft: "3pt solid #d97706", padding: 8, marginBottom: 6, borderRadius: 3 },
  alertLow: { backgroundColor: "#f0f9ff", borderLeft: "3pt solid #0284c7", padding: 8, marginBottom: 6, borderRadius: 3 },
  alertText: { fontSize: 9, color: "#334155" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: "#94a3b8" },
})

/** Renders the dual-logo header row (center logo + ClassMixer brand) for all PDF reports. */
export function PdfLogoRow({ logoUrl }: { logoUrl?: string | null }) {
  return React.createElement(View, { style: pdfStyles.logoRow },
    logoUrl
      ? React.createElement(Image, { src: logoUrl, style: pdfStyles.centerLogo })
      : React.createElement(View, { style: { width: 72 } }),
    React.createElement(View, { style: { alignItems: "flex-end" } },
      React.createElement(Text, { style: pdfStyles.classmixerBrand }, "ClassMixer"),
      React.createElement(Text, { style: pdfStyles.classmixerSub }, "Análisis sociométrico escolar"),
    )
  )
}

export function formatDate(): string {
  return new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
}

export const ALERT_STYLE_BY_SEVERITY: Record<string, typeof pdfStyles.alertHigh> = {
  high: pdfStyles.alertHigh,
  medium: pdfStyles.alertMedium,
  low: pdfStyles.alertLow,
}
