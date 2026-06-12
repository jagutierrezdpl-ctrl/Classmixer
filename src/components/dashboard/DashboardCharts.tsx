"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

interface ProcessProgress {
  name: string
  completed: number
  total: number
  pct: number
}

interface Props {
  processProgress: ProcessProgress[]
}

export default function DashboardCharts({ processProgress }: Props) {
  if (processProgress.length === 0) return null

  return (
    <div className="rounded-xl border bg-card p-5 mb-6">
      <p className="text-sm font-semibold mb-1">Participación en cuestionarios activos</p>
      <p className="text-xs text-muted-foreground mb-4">Respuestas completadas por proceso</p>
      <ResponsiveContainer width="100%" height={Math.max(120, processProgress.length * 44)}>
        <BarChart
          data={processProgress}
          layout="vertical"
          margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
          barSize={18}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={140} />
          <Tooltip
            formatter={(value) => [`${value}%`, "Completado"]}
            contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
            {processProgress.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.pct === 100 ? "#16a34a" : entry.pct >= 70 ? "#4f46e5" : entry.pct >= 40 ? "#f59e0b" : "#e2e8f0"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
