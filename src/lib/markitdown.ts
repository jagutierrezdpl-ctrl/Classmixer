import { execFile } from "child_process"
import { promisify } from "util"
import { writeFile, unlink } from "fs/promises"
import { tmpdir, homedir } from "os"
import { join } from "path"
import { randomUUID } from "crypto"

const execFileAsync = promisify(execFile)

// Override via MARKITDOWN_BIN env var for production deployments
const MARKITDOWN_BIN =
  process.env.MARKITDOWN_BIN ?? join(homedir(), "markitdown-env/bin/markitdown")

export async function isMarkitdownAvailable(): Promise<boolean> {
  try {
    await execFileAsync(MARKITDOWN_BIN, ["--version"], { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

export async function convertPdfToMarkdown(buffer: Buffer, filename: string): Promise<string> {
  const tmpPath = join(tmpdir(), `${randomUUID()}-${filename}`)
  try {
    await writeFile(tmpPath, buffer)
    const { stdout } = await execFileAsync(MARKITDOWN_BIN, [tmpPath], {
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    })
    return stdout.trim()
  } finally {
    await unlink(tmpPath).catch(() => {})
  }
}
