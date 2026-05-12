type ClassDictionary = Record<string, boolean | null | undefined>
type ClassValue =
  | string
  | number
  | ClassDictionary
  | ClassValue[]
  | false
  | null
  | undefined

function toClassString(input: ClassValue): string {
  if (!input) return ''

  if (typeof input === 'string' || typeof input === 'number') {
    return String(input)
  }

  if (Array.isArray(input)) {
    return input.map(toClassString).filter(Boolean).join(' ')
  }

  return Object.entries(input)
    .filter(([, isEnabled]) => Boolean(isEnabled))
    .map(([key]) => key)
    .join(' ')
}

export function cn(...inputs: ClassValue[]) {
  return inputs.map(toClassString).filter(Boolean).join(' ')
}
