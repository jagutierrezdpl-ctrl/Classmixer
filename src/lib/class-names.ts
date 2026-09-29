// EduPlataforma names classes "6º Primaria B"; ClassMixer imports use "6PB". Same class, same key.
export function classKey(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[º°.\s-]+/g, " ")
    .trim()
  const m = clean.match(/^(\d+)\s*(primaria|eso|infantil|bachillerato|p|e)?\s*([a-z])$/)
  if (!m) return clean.replace(/\s/g, "")
  const level = m[2] ? m[2][0] : ""
  return `${m[1]}${level}${m[3]}`
}
