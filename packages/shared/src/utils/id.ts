let counter = 0

export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  const seq = (counter++).toString(36)
  return prefix ? `${prefix}_${timestamp}${random}${seq}` : `${timestamp}${random}${seq}`
}
