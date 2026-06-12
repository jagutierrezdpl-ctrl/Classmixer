"use client"

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts"

const RADAR_DATA = [
  { axis: "Social",      A: 91, B: 78, C: 85 },
  { axis: "Académico",   A: 88, B: 94, C: 90 },
  { axis: "Género",      A: 82, B: 89, C: 76 },
  { axis: "Convivencia", A: 95, B: 80, C: 88 },
  { axis: "Total",       A: 89, B: 85, C: 87 },
]

const GRADE_DATA = [
  { class: "1ºA", A: 6.8, B: 6.9, C: 7.1 },
  { class: "1ºB", A: 7.0, B: 6.7, C: 6.9 },
  { class: "1ºC", A: 6.9, B: 7.1, C: 6.8 },
]

const PARTICIPATION_DATA = [
  { name: "6ºA — ESO 2025/26", pct: 82 },
  { name: "6ºB — ESO 2025/26", pct: 67 },
  { name: "5ºA/B — Mezcla interna", pct: 100 },
]

export default function ProposalPreviewChart() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Radar */}
      <div className="md:col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-900 mb-0.5">Comparativa de propuestas</p>
        <p className="text-xs text-gray-400 mb-4">Puntuación por dimensión</p>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={RADAR_DATA}>
            <PolarGrid stroke="#f1f5f9" />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <Radar name="Propuesta A" dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.12} strokeWidth={2} />
            <Radar name="Propuesta B" dataKey="B" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.10} strokeWidth={2} />
            <Radar name="Propuesta C" dataKey="C" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.10} strokeWidth={2} />
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Bar chart nota media */}
      <div className="md:col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-900 mb-0.5">Nota media por clase</p>
        <p className="text-xs text-gray-400 mb-4">Equilibrio académico entre propuestas</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={GRADE_DATA} barGap={3} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="class" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis domain={[5, 8]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="A" name="Propuesta A" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={14} />
            <Bar dataKey="B" name="Propuesta B" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={14} />
            <Bar dataKey="C" name="Propuesta C" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Participation bar */}
      <div className="md:col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-900 mb-0.5">Participación en cuestionarios</p>
        <p className="text-xs text-gray-400 mb-4">Porcentaje de alumnos que respondieron</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={PARTICIPATION_DATA}
            layout="vertical"
            margin={{ top: 0, right: 36, bottom: 0, left: 0 }}
            barSize={16}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={130} />
            <Tooltip formatter={(v) => [`${v}%`, "Completado"]} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
              {PARTICIPATION_DATA.map((entry, i) => (
                <Cell key={i} fill={entry.pct === 100 ? "#16a34a" : entry.pct >= 70 ? "#4f46e5" : "#f59e0b"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
