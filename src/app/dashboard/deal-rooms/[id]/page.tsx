'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// API URL - auto-detect localhost for development
const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }
  }
  return 'https://aip-api.politesea-b4c1d412.southafricanorth.azurecontainerapps.io';
};

const API_URL = getApiUrl();

interface DealRoom {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  status: string;
  deal_value: number | null;
  deal_currency: string;
  target_close_date: string | null;
  is_video_enabled: boolean;
  is_chat_enabled: boolean;
  require_nda: boolean;
  created_at: string;
}

interface Member {
  id: number;
  user_id: number;
  role: string;
  invitation_status: string;
  can_upload: boolean;
  can_delete: boolean;
  can_invite: boolean;
  nda_signed: boolean;
  joined_at: string;
  user_email?: string;
  user_name?: string;
}

interface Document {
  id: number;
  title: string;
  description: string | null;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  version: number;
  requires_signature: boolean;
  signature_status: string;
  uploaded_at: string;
}

interface Meeting {
  id: number;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  status: string;
}

interface Message {
  id: number;
  user_id: number;
  message: string;
  message_type: string;
  created_at: string;
  user_name?: string;
}

type TabType = 'overview' | 'documents' | 'members' | 'meetings' | 'chat';

export default function DealRoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dealRoomId = params.id as string;

  const [dealRoom, setDealRoom] = useState<DealRoom | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState<Document | null>(null);

  // Form states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [newMessage, setNewMessage] = useState('');
  const [uploadData, setUploadData] = useState({
    title: '',
    description: '',
    document_type: 'other',
    file_name: '',
    file_url: ''
  });
  const [meetingData, setMeetingData] = useState({
    title: '',
    description: '',
    scheduled_at: '',
    duration_minutes: 60
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDealRoom();
    fetchMembers();
    fetchDocuments();
    fetchMeetings();
    fetchMessages();
  }, [dealRoomId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  };

  const fetchDealRoom = async () => {
    try {
      const response = await fetch(`${API_URL}/deal-rooms/${dealRoomId}`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setDealRoom(data);
      }
    } catch (error) {
      console.error('Failed to fetch deal room:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await fetch(`${API_URL}/deal-rooms/${dealRoomId}/members`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_URL}/deal-rooms/${dealRoomId}/documents`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const fetchMeetings = async () => {
    try {
      const response = await fetch(`${API_URL}/deal-rooms/${dealRoomId}/meetings`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setMeetings(data);
      }
    } catch (error) {
      console.error('Failed to fetch meetings:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(`${API_URL}/deal-rooms/${dealRoomId}/messages`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/deal-rooms/${dealRoomId}/members`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      if (response.ok) {
        setShowInviteModal(false);
        setInviteEmail('');
        setInviteRole('member');
        fetchMembers();
      }
    } catch (error) {
      console.error('Failed to invite member:', error);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/deal-rooms/${dealRoomId}/documents`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(uploadData)
      });
      if (response.ok) {
        setShowUploadModal(false);
        setUploadData({ title: '', description: '', document_type: 'other', file_name: '', file_url: '' });
        fetchDocuments();
      }
    } catch (error) {
      console.error('Failed to upload document:', error);
    }
  };

  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/deal-rooms/${dealRoomId}/meetings`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(meetingData)
      });
      if (response.ok) {
        setShowMeetingModal(false);
        setMeetingData({ title: '', description: '', scheduled_at: '', duration_minutes: 60 });
        fetchMeetings();
      }
    } catch (error) {
      console.error('Failed to schedule meeting:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const response = await fetch(`${API_URL}/deal-rooms/${dealRoomId}/messages`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message: newMessage })
      });
      if (response.ok) {
        setNewMessage('');
        fetchMessages();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const getDocumentTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      mou: '📜',
      term_sheet: '📋',
      contract: '📝',
      nda: '🔒',
      financial: '💰',
      legal: '⚖️',
      technical: '⚙️',
      other: '📄'
    };
    return icons[type] || '📄';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      negotiating: 'bg-yellow-100 text-yellow-800',
      closed_won: 'bg-blue-100 text-blue-800',
      closed_lost: 'bg-red-100 text-red-800',
      archived: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!dealRoom) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-xl font-bold text-gray-900">Deal Room not found</h1>
        <Link href="/dashboard/deal-rooms" className="text-indigo-600 hover:underline mt-4 inline-block">
          ← Back to Deal Rooms
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/deal-rooms" className="text-indigo-600 hover:underline text-sm mb-2 inline-block">
          ← Back to Deal Rooms
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{dealRoom.name}</h1>
            {dealRoom.description && (
              <p className="text-gray-600 mt-1">{dealRoom.description}</p>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(dealRoom.status)}`}>
            {dealRoom.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex gap-6">
          {(['overview', 'documents', 'members', 'meetings', 'chat'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 capitalize ${
                activeTab === tab
                  ? 'border-b-2 border-indigo-600 text-indigo-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* Deal Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Deal Information</h3>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Deal Value</dt>
                  <dd className="text-lg font-medium">
                    {dealRoom.deal_value
                      ? new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: dealRoom.deal_currency
                        }).format(dealRoom.deal_value)
                      : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Target Close Date</dt>
                  <dd className="text-lg font-medium">
                    {dealRoom.target_close_date
                      ? new Date(dealRoom.target_close_date).toLocaleDateString()
                      : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Created</dt>
                  <dd className="text-lg font-medium">
                    {new Date(dealRoom.created_at).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">NDA Required</dt>
                  <dd className="text-lg font-medium">{dealRoom.require_nda ? 'Yes' : 'No'}</dd>
                </div>
              </dl>
            </div>

            {/* Recent Documents */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Recent Documents</h3>
                <button
                  onClick={() => setActiveTab('documents')}
                  className="text-indigo-600 text-sm hover:underline"
                >
                  View All →
                </button>
              </div>
              {documents.slice(0, 3).map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 py-3 border-b last:border-b-0">
                  <span className="text-2xl">{getDocumentTypeIcon(doc.document_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.title}</p>
                    <p className="text-sm text-gray-500">{doc.document_type.replace('_', ' ')}</p>
                  </div>
                  <button
                    onClick={() => setShowDocumentViewer(doc)}
                    className="text-indigo-600 hover:underline text-sm"
                  >
                    View
                  </button>
                </div>
              ))}
              {documents.length === 0 && (
                <p className="text-gray-500 text-center py-4">No documents uploaded yet</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                {dealRoom.is_video_enabled && (
                  <button
                    onClick={() => setShowMeetingModal(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Schedule Video Call
                  </button>
                )}
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Document
                </button>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Invite Collaborator
                </button>
              </div>
            </div>

            {/* Members */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Members ({members.length})</h3>
              </div>
              <div className="space-y-3">
                {members.slice(0, 5).map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-indigo-600 font-medium text-sm">
                        {member.user_name?.charAt(0) || member.user_email?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {member.user_name || member.user_email || `User ${member.user_id}`}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                    </div>
                    {member.nda_signed && (
                      <span className="text-green-500" title="NDA Signed">✓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Meetings */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Upcoming Meetings</h3>
              {meetings.filter(m => m.status === 'scheduled').slice(0, 3).map((meeting) => (
                <div key={meeting.id} className="py-3 border-b last:border-b-0">
                  <p className="font-medium text-sm">{meeting.title}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(meeting.scheduled_at).toLocaleString()}
                  </p>
                  {meeting.meeting_url && (
                    <a
                      href={meeting.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 text-sm hover:underline mt-1 inline-block"
                    >
                      Join Meeting →
                    </a>
                  )}
                </div>
              ))}
              {meetings.filter(m => m.status === 'scheduled').length === 0 && (
                <p className="text-gray-500 text-sm">No upcoming meetings</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">All Documents</h3>
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload Document
            </button>
          </div>
          <div className="divide-y">
            {documents.map((doc) => (
              <div key={doc.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                <span className="text-3xl">{getDocumentTypeIcon(doc.document_type)}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium">{doc.title}</h4>
                  <p className="text-sm text-gray-500">{doc.description || 'No description'}</p>
                  <div className="flex gap-4 text-xs text-gray-400 mt-1">
                    <span>{doc.document_type.replace('_', ' ')}</span>
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>v{doc.version}</span>
                    <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doc.requires_signature && (
                    <span className={`px-2 py-1 rounded text-xs ${
                      doc.signature_status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {doc.signature_status === 'completed' ? 'Signed' : 'Pending Signature'}
                    </span>
                  )}
                  <button
                    onClick={() => setShowDocumentViewer(doc)}
                    className="px-3 py-1 border rounded hover:bg-gray-100"
                  >
                    View
                  </button>
                  <a
                    href={doc.file_url}
                    download={doc.file_name}
                    className="px-3 py-1 border rounded hover:bg-gray-100"
                  >
                    Download
                  </a>
                </div>
              </div>
            ))}
            {documents.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-4">No documents uploaded yet</p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="mt-4 text-indigo-600 hover:underline"
                >
                  Upload your first document
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">Team Members ({members.length})</h3>
            <button
              onClick={() => setShowInviteModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Invite Member
            </button>
          </div>
          <div className="divide-y">
            {members.map((member) => (
              <div key={member.id} className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-indigo-600 font-bold text-lg">
                    {member.user_name?.charAt(0) || member.user_email?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">
                    {member.user_name || member.user_email || `User ${member.user_id}`}
                  </h4>
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span className="capitalize">{member.role}</span>
                    <span>Joined {new Date(member.joined_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {member.nda_signed ? (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">NDA Signed</span>
                  ) : dealRoom.require_nda ? (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">NDA Pending</span>
                  ) : null}
                  <div className="flex gap-2 text-xs text-gray-400">
                    {member.can_upload && <span title="Can Upload">📤</span>}
                    {member.can_delete && <span title="Can Delete">🗑️</span>}
                    {member.can_invite && <span title="Can Invite">👥</span>}
                  </div>
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <p>No members yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'meetings' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">Video Meetings</h3>
            <button
              onClick={() => setShowMeetingModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Schedule Meeting
            </button>
          </div>
          <div className="divide-y">
            {meetings.map((meeting) => (
              <div key={meeting.id} className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{meeting.title}</h4>
                  <p className="text-sm text-gray-500">{meeting.description || 'No description'}</p>
                  <div className="flex gap-4 text-xs text-gray-400 mt-1">
                    <span>{new Date(meeting.scheduled_at).toLocaleString()}</span>
                    <span>{meeting.duration_minutes} min</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(meeting.status)}`}>
                    {meeting.status.replace('_', ' ')}
                  </span>
                  {meeting.meeting_url && meeting.status === 'scheduled' && (
                    <a
                      href={meeting.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Join Call
                    </a>
                  )}
                </div>
              </div>
            ))}
            {meetings.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="mt-4">No meetings scheduled</p>
                <button
                  onClick={() => setShowMeetingModal(true)}
                  className="mt-4 text-indigo-600 hover:underline"
                >
                  Schedule your first meeting
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'chat' && dealRoom.is_chat_enabled && (
        <div className="bg-white rounded-lg shadow flex flex-col h-[600px]">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Deal Room Chat</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex-shrink-0 flex items-center justify-center">
                  <span className="text-indigo-600 text-sm font-medium">
                    {msg.user_name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-sm">{msg.user_name || `User ${msg.user_id}`}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-700 mt-1">{msg.message}</p>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-12">
                <p>No messages yet. Start the conversation!</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 border rounded-lg px-4 py-2"
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Invite Collaborator</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="collaborator@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Upload Document</h2>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUploadDocument} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  value={uploadData.title}
                  onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., Term Sheet v2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
                <select
                  value={uploadData.document_type}
                  onChange={(e) => setUploadData({ ...uploadData, document_type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="mou">MoU (Memorandum of Understanding)</option>
                  <option value="term_sheet">Term Sheet</option>
                  <option value="contract">Contract</option>
                  <option value="nda">NDA</option>
                  <option value="financial">Financial Document</option>
                  <option value="legal">Legal Document</option>
                  <option value="technical">Technical Document</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={uploadData.description}
                  onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                  placeholder="Brief description of this document"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Name *</label>
                <input
                  type="text"
                  required
                  value={uploadData.file_name}
                  onChange={(e) => setUploadData({ ...uploadData, file_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="document.pdf"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File URL *</label>
                <input
                  type="url"
                  required
                  value={uploadData.file_url}
                  onChange={(e) => setUploadData({ ...uploadData, file_url: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="https://storage.example.com/doc.pdf"
                />
                <p className="text-xs text-gray-500 mt-1">Enter the URL where the document is hosted</p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Upload Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Schedule Video Meeting</h2>
              <button onClick={() => setShowMeetingModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleScheduleMeeting} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Title *</label>
                <input
                  type="text"
                  required
                  value={meetingData.title}
                  onChange={(e) => setMeetingData({ ...meetingData, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., Term Sheet Discussion"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={meetingData.description}
                  onChange={(e) => setMeetingData({ ...meetingData, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                  placeholder="Meeting agenda and notes"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={meetingData.scheduled_at}
                    onChange={(e) => setMeetingData({ ...meetingData, scheduled_at: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                  <select
                    value={meetingData.duration_minutes}
                    onChange={(e) => setMeetingData({ ...meetingData, duration_minutes: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMeetingModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Schedule Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {showDocumentViewer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{showDocumentViewer.title}</h2>
                <p className="text-sm text-gray-500">
                  {showDocumentViewer.document_type.replace('_', ' ')} • v{showDocumentViewer.version}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={showDocumentViewer.file_url}
                  download={showDocumentViewer.file_name}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Download
                </a>
                <button
                  onClick={() => setShowDocumentViewer(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {showDocumentViewer.mime_type?.includes('pdf') ? (
                <iframe
                  src={showDocumentViewer.file_url}
                  className="w-full h-full min-h-[600px]"
                  title={showDocumentViewer.title}
                />
              ) : showDocumentViewer.mime_type?.includes('image') ? (
                <img
                  src={showDocumentViewer.file_url}
                  alt={showDocumentViewer.title}
                  className="max-w-full mx-auto"
                />
              ) : (
                <div className="text-center py-12">
                  <span className="text-6xl">{getDocumentTypeIcon(showDocumentViewer.document_type)}</span>
                  <p className="mt-4 text-gray-600">{showDocumentViewer.file_name}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Preview not available for this file type
                  </p>
                  <a
                    href={showDocumentViewer.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Open in New Tab
                  </a>
                </div>
              )}
            </div>
            {showDocumentViewer.description && (
              <div className="p-4 border-t bg-gray-50">
                <p className="text-sm text-gray-600">{showDocumentViewer.description}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
