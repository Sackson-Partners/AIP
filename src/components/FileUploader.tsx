'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'

export type UploadedFile = {
  id: string
  name: string
  size: number
  mimeType: string
  blobUrl: string
  type: string
}

type UploadState = {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
  result?: UploadedFile
}

const MIME_TO_CATEGORY: Record<string, string> = {
  'application/pdf':                                                    'FEASIBILITY_STUDY',
  'application/msword':                                                 'OTHER',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'OTHER',
  'application/vnd.ms-excel':                                           'FINANCIAL_MODEL',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'FINANCIAL_MODEL',
  'application/vnd.ms-powerpoint':                                      'OTHER',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'OTHER',
}

function detectCategory(file: File): string {
  if (MIME_TO_CATEGORY[file.type]) return MIME_TO_CATEGORY[file.type]
  if (file.name.toLowerCase().match(/\.(dwg|shp|kmz|kml|geojson)$/)) return 'TECHNICAL_SPECS'
  if (file.name.toLowerCase().match(/(nda|agreement|contract|legal)/)) return 'LEGAL_AGREEMENT'
  if (file.name.toLowerCase().match(/(env|eia|impact|esg)/)) return 'ENVIRONMENTAL_IMPACT'
  if (file.type.startsWith('image/')) return 'OTHER'
  return 'OTHER'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  'application/octet-stream': ['.dwg', '.shp', '.kmz', '.kml'],
  'application/json': ['.geojson'],
}

interface FileUploaderProps {
  uploadUrl: string                          // e.g. /api/deal-rooms/abc123/upload
  onUploaded?: (files: UploadedFile[]) => void
  maxFiles?: number
  maxSizeMb?: number
  className?: string
}

export function FileUploader({
  uploadUrl,
  onUploaded,
  maxFiles = 10,
  maxSizeMb = 50,
  className = '',
}: FileUploaderProps) {
  const [uploads, setUploads] = useState<UploadState[]>([])

  const updateUpload = (idx: number, patch: Partial<UploadState>) =>
    setUploads(prev => prev.map((u, i) => (i === idx ? { ...u, ...patch } : u)))

  const uploadFile = async (file: File, idx: number) => {
    updateUpload(idx, { status: 'uploading', progress: 10 })
    try {
      const category = detectCategory(file)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', category)

      const xhr = new XMLHttpRequest()
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) {
            updateUpload(idx, { progress: Math.round((e.loaded / e.total) * 90) + 5 })
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(xhr.responseText || 'Upload failed'))
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.open('POST', uploadUrl)
        xhr.send(formData)
      })

      const result: { data: UploadedFile } = JSON.parse(xhr.responseText)
      updateUpload(idx, { status: 'done', progress: 100, result: result.data })
      return result.data
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      updateUpload(idx, { status: 'error', error: msg })
      return null
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newUploads: UploadState[] = acceptedFiles.map(f => ({
      file: f, progress: 0, status: 'pending',
    }))
    setUploads(prev => [...prev, ...newUploads])

    const offset = uploads.length
    const results = await Promise.all(
      acceptedFiles.map((f, i) => uploadFile(f, offset + i))
    )
    const succeeded = results.filter((r): r is UploadedFile => r !== null)
    if (succeeded.length > 0) onUploaded?.(succeeded)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploads.length, uploadUrl, onUploaded])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles,
    maxSize: maxSizeMb * 1024 * 1024,
  })

  const clearDone = () => setUploads(prev => prev.filter(u => u.status !== 'done'))

  return (
    <div className={className}>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-brand-gold bg-brand-gold/5'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <svg className="w-10 h-10 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {isDragActive ? (
          <p className="text-brand-gold font-medium">Drop files here…</p>
        ) : (
          <>
            <p className="text-gray-700 font-medium">Drag & drop files here</p>
            <p className="text-gray-400 text-sm mt-1">
              or <span className="text-brand-gold underline">browse</span> — PDF, DOCX, XLSX, PPTX, DWG, images
            </p>
            <p className="text-gray-400 text-xs mt-1">Up to {maxFiles} files · Max {maxSizeMb} MB each</p>
          </>
        )}
      </div>

      {/* Upload list */}
      {uploads.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Files</span>
            {uploads.some(u => u.status === 'done') && (
              <button onClick={clearDone} className="text-xs text-gray-400 hover:text-gray-600">Clear done</button>
            )}
          </div>
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
              {/* Icon */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                u.status === 'done' ? 'bg-green-100' :
                u.status === 'error' ? 'bg-red-100' : 'bg-gray-100'
              }`}>
                {u.status === 'done' ? (
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : u.status === 'error' ? (
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </div>
              {/* Name + progress */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{u.file.name}</p>
                {u.status === 'error' ? (
                  <p className="text-xs text-red-500">{u.error}</p>
                ) : u.status === 'done' ? (
                  <p className="text-xs text-green-600">Uploaded · {formatBytes(u.file.size)}</p>
                ) : (
                  <div className="mt-1">
                    <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-gold rounded-full transition-all duration-300"
                        style={{ width: `${u.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{u.progress}%</p>
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-400 shrink-0">{formatBytes(u.file.size)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
