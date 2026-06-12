"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts"

interface Props {
  byClass: { class: string; completed: number; total: number }[]
  typeCount: Record<string, number>
}

const TYPE_COLORS: Record<string, string> = {
  friendship: "#ec4899",
  work:       "#3b82f6",
  emotional:  "#8b5cf6",
  negative:   "#ef4444",
}
const TYPE_LABELS: Record<string, string> = {
  friendship: "Amistad",
  work:       "Trabajo",
  emotional:  "Apoyo",
  negative:   "Conflicto",
}

export default function ResponseCharts({ byClass, typeCount }: Props) {
  const barData = byClass.map(c => ({
    name: c.class,
    Completados: c.completed,
    Pendientes: c.total - c.completed,
    pct: c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0,
  }))

  const pieData = Object.entries(typeCount)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: TYPE_LABELS[key] ?? key,
      value,
      color: TYPE_COLORS[key] ?? "#94a3b8",
    }))

  if (barData.length === 0 && pieData.length === 0) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
      {/* Participation by class */}
      {barData.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Participación por clase</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barSize={22} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value, name) => [value, name]}
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
              />
              <Bar dataKey="Completados" stackId="a" fill="#4f46e5" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Pendientes"  stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Response type distribution */}
      {pieData.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Tipos de elección</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [value, name]}
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
