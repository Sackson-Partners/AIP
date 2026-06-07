'use client'

import { useState } from 'react'
import { XIcon } from '@/components/ui/icons'

interface NDAModalProps {
  dealRoomId: string
  dealRoomName: string
  memberId: string
  onClose: () => void
  onSigned: (accessCode: string) => void
}

export function NDAModal({ dealRoomId, dealRoomName, memberId, onClose, onSigned }: NDAModalProps) {
  const [agreed, setAgreed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState('')

  const handleSign = async () => {
    if (!agreed) {
      setError('You must agree to the terms to proceed')
      return
    }

    setSigning(true)
    setError('')

    try {
      const response = await fetch(`/api/deal-rooms/${dealRoomId}/members/${memberId}/nda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign NDA')
      }

      // Show access code to user
      onSigned(data.data.accessCode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign NDA')
      setSigning(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-brand-navy to-brand-navy-light">
          <div>
            <h2 className="text-xl font-bold text-white">Non-Disclosure Agreement</h2>
            <p className="text-sm text-brand-gold mt-1">{dealRoomName}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* NDA Content */}
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Confidentiality Required</h3>
                <p className="text-sm text-gray-700">
                  This deal room contains confidential and proprietary information. By signing this NDA, you agree to maintain strict confidentiality.
                </p>
              </div>
            </div>
          </div>

          <div className="prose prose-sm max-w-none">
            <h4 className="font-semibold text-gray-900">Agreement Terms:</h4>
            <ol className="text-sm text-gray-700 space-y-2 pl-4">
              <li>
                <strong>Confidential Information:</strong> All documents, data, communications, and materials accessed through this deal room are confidential.
              </li>
              <li>
                <strong>Non-Disclosure:</strong> You agree not to disclose, share, or distribute any confidential information to third parties without prior written consent.
              </li>
              <li>
                <strong>Limited Use:</strong> Confidential information may only be used for evaluating the proposed transaction and not for any other purpose.
              </li>
              <li>
                <strong>Return or Destruction:</strong> Upon request or termination of discussions, you agree to return or destroy all confidential materials.
              </li>
              <li>
                <strong>Duration:</strong> This agreement remains in effect for 5 years from the date of signing.
              </li>
              <li>
                <strong>Legal Binding:</strong> This NDA is legally binding and violations may result in legal action and damages.
              </li>
            </ol>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Agreement Checkbox */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-5 h-5 text-brand-gold focus:ring-brand-gold rounded"
              />
              <span className="text-sm text-gray-800">
                I have read and understood the terms of this Non-Disclosure Agreement. I agree to be bound by its terms and conditions.
                By checking this box and clicking "Sign NDA", I am providing my electronic signature.
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSign}
            disabled={!agreed || signing}
            className="px-5 py-2.5 text-sm font-semibold bg-brand-gold text-brand-navy rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {signing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing...
              </>
            ) : (
              <>
                ✍️ Sign NDA
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

interface AccessCodeModalProps {
  accessCode: string
  onClose: () => void
}

export function AccessCodeModal({ accessCode, onClose }: AccessCodeModalProps) {
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(accessCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">NDA Signed Successfully!</h2>
          <p className="text-gray-600 mb-6">
            Your 6-digit access code for Data Rooms and Deal Rooms:
          </p>

          <div className="bg-gradient-to-r from-brand-navy to-brand-navy-light rounded-lg p-6 mb-6">
            <div className="text-4xl font-mono font-bold text-brand-gold tracking-wider">
              {accessCode}
            </div>
            <button
              onClick={copyCode}
              className="mt-3 px-4 py-2 bg-brand-gold text-brand-navy text-sm font-medium rounded-lg hover:bg-amber-400 transition"
            >
              {copied ? '✓ Copied!' : '📋 Copy Code'}
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left text-sm text-gray-700 mb-6">
            <p className="font-semibold mb-2">⚠️ Important:</p>
            <ul className="space-y-1 text-xs">
              <li>• Save this code securely - you'll need it to access restricted areas</li>
              <li>• This code is unique to you and should not be shared</li>
              <li>• You may be asked to re-enter this code periodically</li>
            </ul>
          </div>

          <button
            onClick={onClose}
            className="w-full px-5 py-3 bg-brand-navy text-white font-semibold rounded-lg hover:bg-brand-navy-light transition"
          >
            Continue to Deal Room
          </button>
        </div>
      </div>
    </div>
  )
}
