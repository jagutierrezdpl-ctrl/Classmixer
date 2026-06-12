"use client"

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts"

interface Proposal {
  id: string
  name: string
  score_total: number
  score_social: number
  score_academic: number
  score_gender: number
  score_behavior: number
}

interface ClassMetrics {
  average_grade?: number
  count?: number
  female?: number
  male?: number
  students_with_friend?: number
}

interface Props {
  proposals: Proposal[]
  metricsMap: Record<string, Record<string, ClassMetrics>>
}

const COLORS = ["#4f46e5", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"]

export default function ProposalCharts({ proposals, metricsMap }: Props) {
  if (proposals.length === 0) return null

  // Radar data: one axis per score dimension
  const radarData = [
    { axis: "Social",      fullMark: 100 },
    { axis: "Académico",   fullMark: 100 },
    { axis: "Género",      fullMark: 100 },
    { axis: "Convivencia", fullMark: 100 },
    { axis: "Total",       fullMark: 100 },
  ].map(d => {
    const row: Record<string, number | string> = { axis: d.axis }
    proposals.forEach(p => {
      row[p.name] = d.axis === "Social"      ? p.score_social
                  : d.axis === "Académico"   ? p.score_academic
                  : d.axis === "Género"      ? p.score_gender
                  : d.axis === "Convivencia" ? p.score_behavior
                  : p.score_total
    })
    return row
  })

  // Bar data: average grade per class for each proposal
  const allClasses = [...new Set(
    proposals.flatMap(p => Object.keys(metricsMap[p.id] ?? {}))
  )].sort()

  const gradeBarData = allClasses.map(cls => {
    const row: Record<string, string | number> = { class: cls }
    proposals.forEach(p => {
      const m = metricsMap[p.id]?.[cls]
      row[p.name] = m?.average_grade != null ? Math.round(m.average_grade * 10) / 10 : 0
    })
    return row
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
      {/* Radar comparison */}
      <div className="rounded-xl border bg-card p-5">
        <p className="text-sm font-semibold mb-1">Comparativa de puntuaciones</p>
        <p className="text-xs text-muted-foreground mb-4">Radar por dimensión (0–100)</p>
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12 }} />
            {proposals.map((p, i) => (
              <Radar
                key={p.id}
                name={p.name}
                dataKey={p.name}
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.12}
                strokeWidth={2}
              />
            ))}
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Average grade per class per proposal */}
      {gradeBarData.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm font-semibold mb-1">Nota media por clase</p>
          <p className="text-xs text-muted-foreground mb-4">Comparativa entre propuestas</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={gradeBarData} barGap={4} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="class" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              {proposals.map((p, i) => (
                <Bar key={p.id} dataKey={p.name} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} barSize={18} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
