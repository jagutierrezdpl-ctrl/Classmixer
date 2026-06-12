"use client"

const NODES = [
  { id: "L",  cx: 180, cy: 148, r: 15, fill: "#4f46e5", type: "leader"   },
  { id: "A1", cx: 112, cy:  94, r:  9, fill: "#94a3b8", type: "regular"  },
  { id: "A2", cx: 248, cy:  90, r: 10, fill: "#94a3b8", type: "regular"  },
  { id: "A3", cx: 116, cy: 210, r:  8, fill: "#94a3b8", type: "regular"  },
  { id: "A4", cx: 238, cy: 215, r:  9, fill: "#94a3b8", type: "regular"  },
  { id: "A5", cx:  78, cy: 162, r:  7, fill: "#94a3b8", type: "regular"  },
  { id: "A6", cx: 278, cy: 168, r:  7, fill: "#94a3b8", type: "regular"  },
  { id: "BR", cx: 322, cy: 148, r: 11, fill: "#8b5cf6", type: "bridge"   },
  { id: "R",  cx: 404, cy: 124, r: 13, fill: "#6366f1", type: "popular"  },
  { id: "B1", cx: 364, cy:  66, r:  8, fill: "#94a3b8", type: "regular"  },
  { id: "B2", cx: 450, cy:  68, r:  8, fill: "#94a3b8", type: "regular"  },
  { id: "B3", cx: 360, cy: 188, r:  7, fill: "#94a3b8", type: "regular"  },
  { id: "B4", cx: 452, cy: 192, r:  8, fill: "#94a3b8", type: "regular"  },
  { id: "IS", cx: 468, cy: 262, r:  7, fill: "#f59e0b", type: "isolated" },
]

type EdgeKind = "mutual" | "one-way" | "weak"

const RAW_EDGES: [string, string, EdgeKind, number][] = [
  ["L",  "A1", "mutual",  0  ],
  ["L",  "A2", "mutual",  50 ],
  ["L",  "BR", "mutual",  100],
  ["BR", "R",  "mutual",  150],
  ["R",  "B1", "mutual",  200],
  ["L",  "A3", "one-way", 250],
  ["L",  "A4", "one-way", 280],
  ["L",  "A5", "one-way", 310],
  ["L",  "A6", "one-way", 340],
  ["A1", "A2", "one-way", 370],
  ["A3", "A5", "one-way", 390],
  ["R",  "B2", "one-way", 410],
  ["R",  "B3", "one-way", 430],
  ["R",  "B4", "one-way", 450],
  ["B1", "B2", "one-way", 470],
  ["IS", "B4", "weak",    500],
]

const EDGES = RAW_EDGES.map(([fromId, toId, kind, delay]) => {
  const from = NODES.find(n => n.id === fromId)!
  const to   = NODES.find(n => n.id === toId)!
  return { x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy, kind, delay }
})

export default function SociogramIllustration() {
  return (
    <div className="w-full">
      <style>{`
        @keyframes edgeFade  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes nodeScale {
          from { opacity: 0; transform: scale(0) }
          to   { opacity: 1; transform: scale(1) }
        }
        @keyframes leaderGlow {
          0%,100% { filter: drop-shadow(0 0 6px rgba(79,70,229,.45)); }
          50%     { filter: drop-shadow(0 0 16px rgba(79,70,229,.8)); }
        }
      `}</style>

      <svg
        viewBox="0 0 540 300"
        className="w-full max-w-2xl mx-auto"
        aria-label="Sociograma de ejemplo"
      >
        {/* Edges */}
        {EDGES.map((e, i) => (
          <line
            key={i}
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke={e.kind === "mutual" ? "#a5b4fc" : e.kind === "weak" ? "#fcd34d" : "#e2e8f0"}
            strokeWidth={e.kind === "mutual" ? 2.5 : 1.5}
            strokeDasharray={e.kind === "weak" ? "4 4" : undefined}
            opacity={e.kind === "weak" ? 0.7 : 1}
            style={{ animation: `edgeFade .4s ease ${e.delay}ms both` }}
          />
        ))}

        {/* Nodes */}
        {NODES.map((n, i) => (
          <g
            key={n.id}
            style={{
              animation: `nodeScale .4s cubic-bezier(.34,1.56,.64,1) ${620 + i * 55}ms both`,
              transformOrigin: `${n.cx}px ${n.cy}px`,
            }}
          >
            {/* Outer glow rings */}
            {n.type === "leader" && (
              <>
                <circle cx={n.cx} cy={n.cy} r={n.r + 9} fill="#4f46e5" opacity="0.08" />
                <circle cx={n.cx} cy={n.cy} r={n.r + 5} fill="#4f46e5" opacity="0.12" />
              </>
            )}
            {n.type === "bridge" && (
              <circle cx={n.cx} cy={n.cy} r={n.r + 6} fill="#8b5cf6" opacity="0.12" />
            )}
            {n.type === "isolated" && (
              <circle cx={n.cx} cy={n.cy} r={n.r + 5} fill="#f59e0b" opacity="0.15" />
            )}

            <circle
              cx={n.cx} cy={n.cy} r={n.r}
              fill={n.fill}
              stroke="white"
              strokeWidth={n.type === "regular" ? 1.5 : 2}
              style={
                n.type === "leader"
                  ? { animation: `leaderGlow 2.5s ease-in-out 1600ms infinite`, filter: "drop-shadow(0 2px 4px rgba(79,70,229,.35))" }
                  : n.type === "bridge"
                  ? { filter: "drop-shadow(0 2px 4px rgba(139,92,246,.3))" }
                  : n.type === "isolated"
                  ? { filter: "drop-shadow(0 1px 3px rgba(245,158,11,.4))" }
                  : {}
              }
            />
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-5 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block shrink-0" />
          Líder social
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-violet-500 inline-block shrink-0" />
          Alumno puente
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-7 h-0.5 bg-indigo-300 inline-block shrink-0" />
          Relación recíproca
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-7 h-0.5 bg-slate-200 inline-block shrink-0" />
          Elección
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-400 inline-block shrink-0" />
          Alumno aislado
        </span>
      </div>
    </div>
  )
}
