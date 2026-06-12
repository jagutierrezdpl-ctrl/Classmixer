"use client"

import { use, useEffect, useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Heart, UserX, UserCheck, Users, Check, X } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"
import type { Student, Response } from "@/types"

const CytoscapeGraph = dynamic(() => import("@/components/sociogram/ClassSimulationGraph"), { ssr: false })

interface Assignment {
  student_id: string
  target_class: string
  students: Student
}

interface ClassData {
  cls: string
  students: Student[]
  responses: Response[]
  stats: {
    total: number
    withFriend: number
    isolated: number
    reciprocal: number
  }
}

function buildClassStats(students: Student[], responses: Response[]) {
  const ids = new Set(students.map(s => s.id))
  let withFriend = 0
  let reciprocal = 0

  const friendsOf = new Map<string, Set<string>>()
  for (const s of students) friendsOf.set(s.id, new Set())

  for (const r of responses) {
    if (ids.has(r.respondent_student_id) && ids.has(r.target_student_id)) {
      friendsOf.get(r.respondent_student_id)?.add(r.target_student_id)
    }
  }

  for (const s of students) {
    const myFriends = friendsOf.get(s.id) ?? new Set()
    if (myFriends.size > 0) withFriend++
    // count reciprocal pairs (count each pair once)
    for (const fid of myFriends) {
      if ((friendsOf.get(fid)?.has(s.id)) && s.id < fid) reciprocal++
    }
  }

  return {
    total: students.length,
    withFriend,
    isolated: students.length - withFriend,
    reciprocal,
  }
}

export default function SimulationPage({
  params,
}: {
  params: Promise<{ id: string; proposalId: string }>
}) {
  const { id: processId, proposalId } = use(params)

  const [loading, setLoading] = useState(true)
  const [proposalName, setProposalName] = useState("")
  const [classes, setClasses] = useState<ClassData[]>([])
  const [activeClass, setActiveClass] = useState<string | null>(null)
  const [allStudentMap, setAllStudentMap] = useState<Record<string, Student>>({})
  const [allAssignmentMap, setAllAssignmentMap] = useState<Record<string, string>>({})
  const [allFriendships, setAllFriendships] = useState<Response[]>([])
  const printRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [procRes, propRes, respRes] = await Promise.all([
        fetch(`/api/processes/${processId}`),
        fetch(`/api/proposals/${proposalId}`),
        fetch(`/api/processes/${processId}/responses`),
      ])

      if (!procRes.ok || !propRes.ok) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const proc = await procRes.json() as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prop = await propRes.json() as any
      const allResponses: Response[] = respRes.ok ? await respRes.json() : []

      setProposalName(prop.name ?? "Propuesta")

      const targetClasses: string[] = (proc.target_groups as string[]) ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allAssignments: Assignment[] = (prop.proposal_assignments ?? []).map((a: any) => ({
        ...a,
        students: a.students,
      }))

      const friendships = allResponses.filter(r => r.relation_type === "friendship")

      const studentMap: Record<string, Student> = {}
      const assignmentMap: Record<string, string> = {}
      for (const a of allAssignments) {
        if (a.students) studentMap[a.student_id] = a.students
        assignmentMap[a.student_id] = a.target_class
      }
      setAllStudentMap(studentMap)
      setAllAssignmentMap(assignmentMap)
      setAllFriendships(friendships)

      const classDataList: ClassData[] = targetClasses.map(cls => {
        const classAssignments = allAssignments.filter(a => a.target_class === cls)
        const classStudents = classAssignments.map(a => a.students).filter(Boolean) as Student[]
        const ids = new Set(classStudents.map(s => s.id))
        const classResponses = friendships.filter(
          r => ids.has(r.respondent_student_id) && ids.has(r.target_student_id)
        )
        return {
          cls,
          students: classStudents,
          responses: classResponses,
          stats: buildClassStats(classStudents, classResponses),
        }
      })

      setClasses(classDataList)
      if (classDataList.length > 0) setActiveClass(classDataList[0].cls)
    } finally {
      setLoading(false)
    }
  }, [processId, proposalId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Cargando simulación...</div>
      </div>
    )
  }

  const activeData = classes.find(c => c.cls === activeClass)

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/processes/${processId}/proposals`}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Simulación social</h1>
          <p className="text-muted-foreground text-sm">{proposalName}</p>
        </div>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {classes.map(c => {
          const pct = c.stats.total > 0 ? Math.round((c.stats.withFriend / c.stats.total) * 100) : 0
          return (
            <Card
              key={c.cls}
              className={`cursor-pointer transition-all ${activeClass === c.cls ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"}`}
              onClick={() => setActiveClass(c.cls)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-lg">{c.cls}</p>
                  <Users className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{pct}%</p>
                <p className="text-xs text-muted-foreground">con al menos un amigo</p>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-green-500" : pct >= 70 ? "bg-amber-400" : "bg-red-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span className="text-green-600 flex items-center gap-0.5">
                    <UserCheck className="w-3 h-3" /> {c.stats.withFriend}
                  </span>
                  {c.stats.isolated > 0 && (
                    <span className="text-red-500 flex items-center gap-0.5">
                      <UserX className="w-3 h-3" /> {c.stats.isolated}
                    </span>
                  )}
                  <span className="text-blue-500 flex items-center gap-0.5">
                    <Heart className="w-3 h-3" /> {c.stats.reciprocal}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Active class detail */}
      {activeData && (
        <div ref={printRef} className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Sociograma — Clase {activeData.cls}
                <span className="font-normal text-muted-foreground text-sm ml-2">
                  {activeData.stats.total} alumnos · {activeData.stats.withFriend} con amigo ·{" "}
                  {activeData.stats.isolated > 0 ? <span className="text-red-500">{activeData.stats.isolated} sin amigo</span> : "todos con amigo"}{" "}
                  · {activeData.stats.reciprocal} pares recíprocos
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[500px] w-full rounded-b-xl overflow-hidden">
                <CytoscapeGraph
                  students={activeData.students}
                  responses={activeData.responses}
                />
              </div>
            </CardContent>
          </Card>

          {/* Students table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Alumnos en {activeData.cls}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2">Nombre</th>
                    <th className="text-center px-4 py-2">Clase origen</th>
                    <th className="text-center px-4 py-2">Amigos en clase</th>
                    <th className="text-center px-4 py-2">Estado social</th>
                  </tr>
                </thead>
                <tbody>
                  {activeData.students
                    .sort((a, b) => (a.last_name ?? "").localeCompare(b.last_name ?? ""))
                    .map(student => {
                      const ids = new Set(activeData.students.map(s => s.id))
                      const myFriends = activeData.responses.filter(r => r.respondent_student_id === student.id && ids.has(r.target_student_id))
                      const isChosen = activeData.responses.some(r => r.target_student_id === student.id)
                      const isIsolated = myFriends.length === 0 && !isChosen

                      return (
                        <tr key={student.id} className={`border-b last:border-0 ${isIsolated ? "bg-red-50" : ""}`}>
                          <td className="px-4 py-2 font-medium">
                            {student.last_name}, {student.first_name}
                          </td>
                          <td className="px-4 py-2 text-center text-muted-foreground">{student.current_class}</td>
                          <td className="px-4 py-2 text-center">{myFriends.length}</td>
                          <td className="px-4 py-2 text-center">
                            {isIsolated ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Sin conexiones</span>
                            ) : myFriends.length >= 2 ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Bien integrado</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Conexión limitada</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Friendship satisfaction */}
          {(() => {
            const sortedStudents = [...activeData.students].sort((a, b) =>
              (a.last_name ?? "").localeCompare(b.last_name ?? "")
            )
            const myClass = activeData.cls

            // Global stats for this class
            let p1InClass = 0
            let anyInClass = 0
            let withChoices = 0
            for (const s of sortedStudents) {
              const choices = allFriendships
                .filter(r => r.respondent_student_id === s.id)
                .sort((a, b) => b.weight - a.weight)
                .slice(0, 3)
              if (choices.length === 0) continue
              withChoices++
              const p1 = choices[0]
              if (allAssignmentMap[p1.target_student_id] === myClass) p1InClass++
              if (choices.some(c => allAssignmentMap[c.target_student_id] === myClass)) anyInClass++
            }

            return (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Heart className="w-4 h-4 text-pink-500" />
                    Satisfacción de elecciones — Clase {activeData.cls}
                    {withChoices > 0 && (
                      <span className="font-normal text-muted-foreground text-sm">
                        · {Math.round((p1InClass / withChoices) * 100)}% con 1ª elección en clase
                        · {Math.round((anyInClass / withChoices) * 100)}% con alguna elección en clase
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2">Alumno</th>
                        <th className="text-center px-4 py-2">1ª elección</th>
                        <th className="text-center px-4 py-2">2ª elección</th>
                        <th className="text-center px-4 py-2">3ª elección</th>
                        <th className="text-center px-4 py-2">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStudents.map(student => {
                        const choices = allFriendships
                          .filter(r => r.respondent_student_id === student.id)
                          .sort((a, b) => b.weight - a.weight)
                          .slice(0, 3)

                        const satisfied = choices.filter(
                          c => allAssignmentMap[c.target_student_id] === myClass
                        ).length

                        return (
                          <tr key={student.id} className="border-b last:border-0">
                            <td className="px-4 py-2 font-medium">
                              {student.last_name}, {student.first_name}
                            </td>
                            {[0, 1, 2].map(i => {
                              const choice = choices[i]
                              if (!choice) {
                                return (
                                  <td key={i} className="px-4 py-2 text-center text-muted-foreground/40 text-xs">
                                    —
                                  </td>
                                )
                              }
                              const target = allStudentMap[choice.target_student_id]
                              const inSameClass = allAssignmentMap[choice.target_student_id] === myClass
                              return (
                                <td key={i} className="px-4 py-2 text-center">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-xs text-muted-foreground leading-tight">
                                      {target ? `${target.first_name} ${target.last_name}` : "—"}
                                    </span>
                                    {inSameClass ? (
                                      <Check className="w-3.5 h-3.5 text-green-500" />
                                    ) : (
                                      <X className="w-3.5 h-3.5 text-red-400" />
                                    )}
                                  </div>
                                </td>
                              )
                            })}
                            <td className="px-4 py-2 text-center">
                              {choices.length === 0 ? (
                                <span className="text-xs text-muted-foreground">Sin elecciones</span>
                              ) : (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full ${
                                    satisfied === 0
                                      ? "bg-red-100 text-red-700"
                                      : satisfied >= choices.length
                                      ? "bg-green-100 text-green-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {satisfied}/{choices.length}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )
          })()}
        </div>
      )}
    </div>
  )
}
