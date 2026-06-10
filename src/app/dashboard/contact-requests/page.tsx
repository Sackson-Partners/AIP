'use client'

import { useEffect, useState } from 'react'
import { contactRequestsApi, ContactRequest } from '@/lib/api'
import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { XIcon } from '@/components/ui/icons'

type TabType = 'sent' | 'received'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]

export default function ContactRequestsPage() {
  const { data: session } = useSession()
  const [tab, setTab] = useState<TabType>('sent')
  const [requests, setRequests] = useState<ContactRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [selectedRequest, setSelectedRequest] = useState<ContactRequest | null>(null)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [contactInfo, setContactInfo] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isAdmin = ADMIN_ROLES.includes(session?.user?.role as UserRole)

  const fetchRequests = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await contactRequestsApi.list({ type: tab })
      setRequests(data)
    } catch (err) {
      console.error('Failed to fetch requests:', err)
      setError('Failed to load contact requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [tab])

  const handleApprove = async () => {
    if (!selectedRequest) return
    setSubmitting(true)
    setError(null)
    try {
      await contactRequestsApi.approve(selectedRequest.id, contactInfo || undefined)
      setShowApproveModal(false)
      setContactInfo('')
      setSelectedRequest(null)
      fetchRequests()
    } catch (err) {
      console.error('Failed to approve request:', err)
      setError('Failed to approve request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) return
    setSubmitting(true)
    setError(null)
    try {
      await contactRequestsApi.reject(selectedRequest.id, rejectionReason || undefined)
      setShowRejectModal(false)
      setRejectionReason('')
      setSelectedRequest(null)
      fetchRequests()
    } catch (err) {
      console.error('Failed to reject request:', err)
      setError('Failed to reject request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleWithdraw = async (request: ContactRequest) => {
    if (!confirm('Are you sure you want to withdraw this request?')) return
    try {
      await contactRequestsApi.withdraw(request.id)
      fetchRequests()
    } catch (err) {
      console.error('Failed to withdraw request:', err)
      setError('Failed to withdraw request')
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      WITHDRAWN: 'bg-gray-100 text-gray-600',
    }
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-600'
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Contact Requests</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage contact information requests for projects, investors, and partners
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setTab('sent')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
              tab === 'sent'
                ? 'border-brand-gold text-brand-gold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Sent Requests
          </button>
          {isAdmin && (
            <button
              onClick={() => setTab('received')}
              className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
                tab === 'received'
                  ? 'border-brand-gold text-brand-gold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Approval
            </button>
          )}
        </nav>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm">
          <p className="text-gray-500">
            {tab === 'sent' ? 'You have not sent any contact requests yet.' : 'No pending requests to review.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800">
                      {request.targetType}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${getStatusBadge(request.status)}`}>
                      {request.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Target ID:</span> {request.targetId}
                  </p>
                  {request.message && (
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Message:</span> {request.message}
                    </p>
                  )}
                  {request.status === 'APPROVED' && request.contactInfo && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg">
                      <p className="text-sm font-medium text-green-900 mb-1">Contact Information:</p>
                      <p className="text-sm text-green-800 whitespace-pre-wrap">{request.contactInfo}</p>
                    </div>
                  )}
                  {request.status === 'REJECTED' && request.rejectionReason && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg">
                      <p className="text-sm font-medium text-red-900 mb-1">Rejection Reason:</p>
                      <p className="text-sm text-red-800">{request.rejectionReason}</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Requested: {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  {tab === 'sent' && request.status === 'PENDING' && (
                    <button
                      onClick={() => handleWithdraw(request)}
                      className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                    >
                      Withdraw
                    </button>
                  )}
                  {tab === 'received' && request.status === 'PENDING' && isAdmin && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedRequest(request)
                          setShowApproveModal(true)
                        }}
                        className="px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRequest(request)
                          setShowRejectModal(true)
                        }}
                        className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-5 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Approve Contact Request</h2>
                <button onClick={() => setShowApproveModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                Provide contact information to share with the requester:
              </p>
              <textarea
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="Email: example@company.com&#10;Phone: +1234567890&#10;Contact Person: John Doe"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
              />
              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? 'Approving...' : 'Approve Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-5 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Reject Contact Request</h2>
                <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                Optionally provide a reason for rejecting this request:
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection (optional)..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
              />
              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? 'Rejecting...' : 'Reject Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
