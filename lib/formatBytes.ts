/**
 * Format bytes to human-readable string
 *
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/**
 * Parse human-readable size string to bytes
 *
 * @param sizeStr - Size string (e.g., "1.5GB", "500 MB")
 * @returns Number of bytes
 */
export function parseBytes(sizeStr: string): number {
  const units: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
    PB: 1024 ** 5,
  }

  const match = sizeStr.trim().match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)$/i)
  if (!match) {
    throw new Error(`Invalid size format: ${sizeStr}`)
  }

  const [, valueStr, unit] = match
  const value = parseFloat(valueStr)
  const unitKey = unit.toUpperCase()

  if (!(unitKey in units)) {
    throw new Error(`Unknown unit: ${unit}`)
  }

  return Math.floor(value * units[unitKey])
}
