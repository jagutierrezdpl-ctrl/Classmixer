// Cliente para llamar a la API de EduPlataforma (hub) desde ClassMixer.
// Autenticación: Authorization: Bearer EDUPLATFORMA_SECRET.

export interface EduplataformaUser {
  id: string
  name: string | null
  email: string | null
  role: string
  secondary_roles: string[]
}

export interface EduplataformaMember {
  id: string
  type: string
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  group_name: string | null
  subject: string | null
  school_year: string | null
  external_id: string | null
  active: boolean
}

export interface EduplataformaGroupMembership {
  member_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  member_type: string | null
  group_id: string
  group_name: string | null
  role: string
  school_year: string | null
}

function baseUrl(): string {
  const url = process.env.EDUPLATFORMA_BASE_URL
  if (!url) throw new Error("EDUPLATFORMA_BASE_URL not set")
  return url
}

function secret(): string {
  const s = process.env.EDUPLATFORMA_SECRET
  if (!s) throw new Error("EDUPLATFORMA_SECRET not set")
  return s
}

async function eduplataformaFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${secret()}` },
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`EduPlataforma ${path} -> ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

export async function getUsers(centerId: string): Promise<EduplataformaUser[]> {
  const data = await eduplataformaFetch<{ users: EduplataformaUser[] }>(
    `/api/center/${centerId}/users`
  )
  return data.users
}

export async function getMembers(
  centerId: string,
  opts: { type?: string; school_year?: string } = {}
): Promise<EduplataformaMember[]> {
  const params = new URLSearchParams()
  if (opts.type) params.set("type", opts.type)
  if (opts.school_year) params.set("school_year", opts.school_year)
  const qs = params.toString()
  const data = await eduplataformaFetch<{ members: EduplataformaMember[] }>(
    `/api/center/${centerId}/members${qs ? `?${qs}` : ""}`
  )
  return data.members
}

export async function getGroupMemberships(
  centerId: string,
  schoolYear?: string
): Promise<EduplataformaGroupMembership[]> {
  const qs = schoolYear ? `?school_year=${encodeURIComponent(schoolYear)}` : ""
  const data = await eduplataformaFetch<{ memberships: EduplataformaGroupMembership[] }>(
    `/api/center/${centerId}/group-memberships${qs}`
  )
  return data.memberships
}

export async function postMemberLink(
  centerId: string,
  args: { member_id: string; external_id: string }
): Promise<void> {
  const res = await fetch(`${baseUrl()}/api/center/${centerId}/member-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      member_id: args.member_id,
      app_code: "classmixer",
      external_id: args.external_id,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`EduPlataforma member-links -> ${res.status}: ${body}`)
  }
}
