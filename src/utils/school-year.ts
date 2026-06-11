/** Returns "YYYY-YYYY+1" for the academic year that contains the given date.
 *  School year runs September → July. August is considered part of the ending year. */
export function getCurrentSchoolYear(date: Date = new Date()): string {
  const month = date.getMonth() + 1 // 1-12
  const year = date.getFullYear()
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

/** Returns an array of school year strings centered around the current one.
 *  `before` years before the current, `after` years after. */
export function getSchoolYears(before = 1, after = 3): string[] {
  const current = getCurrentSchoolYear()
  const startYear = parseInt(current.split("-")[0]) - before
  return Array.from({ length: before + 1 + after }, (_, i) => {
    const y = startYear + i
    return `${y}-${y + 1}`
  })
}
