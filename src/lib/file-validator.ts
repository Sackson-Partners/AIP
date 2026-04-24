const MAX_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.csv',
])

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.sh', '.ps1', '.py', '.js', '.ts', '.php',
  '.dll', '.zip', '.sql',
])

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot === -1 ? '' : filename.slice(dot).toLowerCase()
}

export function validateUpload(file: {
  name: string
  type: string
  size: number
}): { valid: boolean; error?: string; sanitizedName?: string } {
  // Path traversal check
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return { valid: false, error: 'Invalid filename: path traversal not allowed.' }
  }

  const ext = getExtension(file.name)

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type "${ext}" is not allowed for security reasons.` }
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type "${ext}" is not supported. Allowed: PDF, Office docs, images, CSV.` }
  }

  if (file.size > MAX_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    return { valid: false, error: `File too large (${mb} MB). Maximum allowed size is 50 MB.` }
  }

  // Sanitize filename
  const base = file.name.slice(0, file.name.lastIndexOf('.'))
  const sanitizedBase = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_')
  const sanitizedName = `${sanitizedBase}${ext}`

  return { valid: true, sanitizedName }
}
