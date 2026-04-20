/**
 * Parse the stdout of `ls /home` from the PicoRuby R2P2 shell into a list
 * of filenames. Deliberately forgiving: splits on any whitespace run and
 * filters empties. Drops directory entries (anything ending in `/`).
 */
export function parseLsOutput(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !s.endsWith('/'));
}
