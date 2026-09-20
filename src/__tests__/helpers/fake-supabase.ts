// Doble de Supabase en memoria para probar rutas y librerías sin red.
// Implementa lo justo de PostgREST: filtros (eq, in, not, or/ilike), orden, ventana (range/limit),
// máximo de 1000 filas por lectura, single/maybeSingle, count exacto, insert/upsert/update/delete.
// Guarda cada operación en `log` para poder comprobar QUÉ filtros llevó una escritura.

export type Row = Record<string, unknown>

export interface PgError {
  code: string
  message: string
}

interface Result {
  data: unknown
  error: PgError | null
  count?: number | null
}

export interface LoggedOp {
  table: string
  op: "select" | "insert" | "upsert" | "update" | "delete"
  filters: string[]
  // Valores de cada filtro `in` (columna → lista), para comprobar QUÉ ids consultó una lectura.
  inValues?: Record<string, unknown[]>
  rows?: number
}

export class FakeSupabase {
  tables: Record<string, Row[]> = {}
  log: LoggedOp[] = []
  // Error que devuelve la siguiente operación del tipo indicado sobre la tabla ("tabla:op").
  failNext: Record<string, PgError> = {}
  private seq = 0

  from(table: string) {
    return new Query(this, table)
  }
  rows(table: string): Row[] {
    return (this.tables[table] ??= [])
  }
  seed(table: string, rows: Row[]) {
    this.tables[table] = rows.map((r) => ({ ...r }))
  }
  nextId() {
    return `gen-${++this.seq}`
  }
  ops(table: string, op: LoggedOp["op"]) {
    return this.log.filter((l) => l.table === table && l.op === op)
  }
}

class Query implements PromiseLike<Result> {
  private op: LoggedOp["op"] = "select"
  private filters: ((r: Row) => boolean)[] = []
  private filterLog: string[] = []
  private inLog: Record<string, unknown[]> = {}
  private payload: Row[] = []
  private patch: Row = {}
  private conflict: string[] = []
  private returning = false
  private cols = "*"
  private orders: string[] = []
  private window: [number, number] | null = null
  private mode: "many" | "single" | "maybe" = "many"
  private wantCount = false
  private headOnly = false

  constructor(
    private db: FakeSupabase,
    private table: string
  ) {}

  select(cols = "*", opts: { count?: string; head?: boolean } = {}) {
    this.returning = true
    this.cols = cols
    this.wantCount = opts.count === "exact"
    this.headOnly = !!opts.head
    return this
  }
  eq(col: string, value: unknown) {
    this.filters.push((r) => r[col] === value)
    this.filterLog.push(`eq:${col}`)
    return this
  }
  neq(col: string, value: unknown) {
    this.filters.push((r) => r[col] !== value)
    this.filterLog.push(`neq:${col}`)
    return this
  }
  is(col: string, value: null) {
    if (value !== null) throw new Error("FakeSupabase.is: solo se admite null")
    this.filters.push((r) => r[col] === null || r[col] === undefined)
    this.filterLog.push(`is:${col}`)
    return this
  }
  in(col: string, values: unknown[]) {
    this.filters.push((r) => values.includes(r[col]))
    this.filterLog.push(`in:${col}`)
    this.inLog[col] = [...values]
    return this
  }
  not(col: string, operator: string, value: unknown) {
    if (operator === "is" && value === null) {
      this.filters.push((r) => r[col] !== null && r[col] !== undefined)
    } else if (operator === "in") {
      // value: '("No","")'
      const list = String(value)
        .replace(/^\(|\)$/g, "")
        .split(",")
        .map((v) => v.replace(/^"|"$/g, ""))
      this.filters.push((r) => !list.includes(String(r[col] ?? "")))
    } else {
      throw new Error(`FakeSupabase.not: operador no soportado ${operator}`)
    }
    this.filterLog.push(`not:${col}`)
    return this
  }
  // Solo el patrón `col.ilike.%texto%,col2.ilike.%texto%` que usa el listado de alumnado.
  or(expr: string) {
    const parts = expr.split(",").map((p) => {
      const [col, op, pattern] = p.split(".")
      if (op !== "ilike") throw new Error(`FakeSupabase.or: operador no soportado ${op}`)
      return { col, needle: pattern.replace(/%/g, "").toLowerCase() }
    })
    this.filters.push((r) => parts.some((p) => String(r[p.col] ?? "").toLowerCase().includes(p.needle)))
    this.filterLog.push("or")
    return this
  }
  order(col: string) {
    this.orders.push(col)
    return this
  }
  range(from: number, to: number) {
    this.window = [from, to]
    return this
  }
  limit(n: number) {
    this.window = [0, n - 1]
    return this
  }
  single() {
    this.mode = "single"
    return this
  }
  maybeSingle() {
    this.mode = "maybe"
    return this
  }
  insert(rows: Row | Row[]) {
    this.op = "insert"
    this.payload = Array.isArray(rows) ? rows : [rows]
    return this
  }
  upsert(rows: Row | Row[], opts: { onConflict?: string } = {}) {
    this.op = "upsert"
    this.payload = Array.isArray(rows) ? rows : [rows]
    this.conflict = (opts.onConflict ?? "").split(",").filter(Boolean)
    return this
  }
  update(patch: Row) {
    this.op = "update"
    this.patch = patch
    return this
  }
  delete() {
    this.op = "delete"
    return this
  }

  then<R1 = Result, R2 = never>(
    onfulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected)
  }

  private project(row: Row): Row {
    if (this.cols === "*") return { ...row }
    const out: Row = {}
    // Relaciones embebidas (`users(id, name)`, `processes!inner(center_id)`): no se resuelven; si la
    // fila ya trae la relación sembrada (row.users) se devuelve tal cual.
    for (const token of splitTopLevel(this.cols)) {
      if (token === "*") Object.assign(out, row)
      else if (token.includes("(")) {
        const rel = token.slice(0, token.indexOf("(")).split("!")[0].split(":").pop()!.trim()
        if (rel in row) out[rel] = row[rel]
      } else out[token] = row[token]
    }
    return out
  }

  private shape(rows: Row[], count: number | null = null): Result {
    const data = rows.map((r) => this.project(r))
    if (this.mode === "many") return { data: this.headOnly ? null : data, error: null, count }
    if (data.length === 1) return { data: data[0], error: null }
    if (data.length === 0 && this.mode === "maybe") return { data: null, error: null }
    return { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } }
  }

  private run(): Result {
    const { db, table } = this
    db.log.push({
      table,
      op: this.op,
      filters: this.filterLog,
      inValues: Object.keys(this.inLog).length ? this.inLog : undefined,
      rows: this.payload.length || undefined,
    })

    const injected = db.failNext[`${table}:${this.op}`]
    if (injected) {
      delete db.failNext[`${table}:${this.op}`]
      return { data: null, error: injected }
    }

    const stored = db.rows(table)
    const matching = () => stored.filter((r) => this.filters.every((f) => f(r)))

    if (this.op === "select") {
      let rows = matching()
      const total = rows.length
      for (const key of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? "")))
      }
      const [from, to] = this.window ?? [0, 999]
      rows = rows.slice(from, Math.min(to, from + 999) + 1) // PostgREST: máx. 1000 filas por petición
      return this.shape(rows, this.wantCount ? total : null)
    }

    if (this.op === "update") {
      const hit = matching()
      for (const row of hit) Object.assign(row, this.patch)
      return this.returning ? this.shape(hit) : { data: null, error: null }
    }

    if (this.op === "delete") {
      const hit = new Set(matching())
      db.tables[table] = stored.filter((r) => !hit.has(r))
      return { data: null, error: null }
    }

    if (this.op === "insert") {
      const created = this.payload.map((p) => ({ id: db.nextId(), ...p }))
      stored.push(...created)
      return this.returning ? this.shape(created) : { data: null, error: null }
    }

    // upsert
    const touched: Row[] = []
    for (const proposed of this.payload) {
      const target = this.conflict.length
        ? stored.find((r) => this.conflict.every((c) => r[c] !== undefined && r[c] === proposed[c]))
        : undefined
      if (target) {
        Object.assign(target, proposed)
        touched.push(target)
      } else {
        const created = { id: db.nextId(), ...proposed }
        stored.push(created)
        touched.push(created)
      }
    }
    return this.returning ? this.shape(touched) : { data: null, error: null }
  }
}

// Separa `a, b(c, d(e)), *` por las comas que no están dentro de paréntesis.
function splitTopLevel(cols: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ""
  for (const ch of cols) {
    if (ch === "(") depth++
    if (ch === ")") depth--
    if (ch === "," && depth === 0) {
      parts.push(current.trim())
      current = ""
    } else current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}
