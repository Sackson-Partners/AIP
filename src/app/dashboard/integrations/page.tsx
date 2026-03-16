'use client';
import { useState } from 'react';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'connected' | 'not_configured';
  docsUrl: string;
  setupInstructions?: string[];
  envVars?: string[];
}

const integrations: Integration[] = [
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'Sync project data, risks, and assessments with Airtable bases for powerful spreadsheet-style views and automations.',
    category: 'Data & Productivity',
    status: 'connected',
    docsUrl: 'https://airtable.com/developers/web/api/introduction',
    envVars: ['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID'],
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Host deal room video calls, project meetings, and investor updates directly within Teams.',
    category: 'Video Conferencing',
    status: 'not_configured',
    docsUrl: 'https://learn.microsoft.com/en-us/graph/api/resources/communications-api-overview',
    setupInstructions: [
      'Register an app in Azure Active Directory at portal.azure.com',
      'Enable the Microsoft Graph API with Calls.InitiateGroupCalls.All permission',
      'Copy your Application (client) ID and Directory (tenant) ID',
      'Create a client secret under Certificates & Secrets',
      'Add MICROSOFT_TEAMS_CLIENT_ID, MICROSOFT_TEAMS_CLIENT_SECRET, and MICROSOFT_TEAMS_TENANT_ID to Railway',
    ],
    envVars: ['MICROSOFT_TEAMS_CLIENT_ID', 'MICROSOFT_TEAMS_CLIENT_SECRET', 'MICROSOFT_TEAMS_TENANT_ID'],
  },
  {
    id: 'docusign',
    name: 'DocuSign',
    description: 'Send, sign, and manage legal documents, NDAs, investment agreements, and term sheets electronically.',
    category: 'Legal & Documents',
    status: 'not_configured',
    docsUrl: 'https://developers.docusign.com/docs/esign-rest-api/how-to/create-envelope/',
    setupInstructions: [
      'Create a DocuSign developer account at developers.docusign.com',
      'Go to My Apps & Keys and create a new integration',
      'Copy your Integration Key (client ID) and Account ID',
      'Generate an RSA keypair and upload the public key to DocuSign',
      'Add DOCUSIGN_INTEGRATION_KEY and DOCUSIGN_ACCOUNT_ID to Railway',
    ],
    envVars: ['DOCUSIGN_INTEGRATION_KEY', 'DOCUSIGN_ACCOUNT_ID', 'DOCUSIGN_BASE_URL'],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Process investment payments, subscription fees, and manage financial transactions securely.',
    category: 'Payments',
    status: 'not_configured',
    docsUrl: 'https://stripe.com/docs/api',
    setupInstructions: [
      'Create a Stripe account at stripe.com and complete business verification',
      'Go to Developers > API Keys in the Stripe dashboard',
      'Copy your Secret Key (starts with sk_live_) and Publishable Key',
      'Set up a webhook endpoint and copy the Webhook Signing Secret',
      'Add STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, and STRIPE_WEBHOOK_SECRET to Railway',
    ],
    envVars: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
  },
  {
    id: 'calendly',
    name: 'Calendly',
    description: 'Schedule investor meetings, due diligence calls, and project reviews with automated calendar management.',
    category: 'Scheduling',
    status: 'not_configured',
    docsUrl: 'https://developer.calendly.com/api-docs',
    setupInstructions: [
      'Log in to Calendly and go to Integrations & Apps > API & Webhooks',
      'Generate a Personal Access Token',
      'Add CALENDLY_API_KEY to Railway environment variables',
    ],
    envVars: ['CALENDLY_API_KEY'],
  },
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Alternative video conferencing for deal rooms, investor calls, and project site visit walkthroughs.',
    category: 'Video Conferencing',
    status: 'not_configured',
    docsUrl: 'https://developers.zoom.us/docs/api/',
    setupInstructions: [
      'Go to marketplace.zoom.us and click Develop > Build App',
      'Choose Server-to-Server OAuth app type',
      'Enable meeting scopes (meeting:write, meeting:read)',
      'Copy your Account ID, Client ID, and Client Secret',
      'Add ZOOM_API_KEY and ZOOM_API_SECRET to Railway environment variables',
    ],
    envVars: ['ZOOM_API_KEY', 'ZOOM_API_SECRET'],
  },
];

const categoryColors: Record<string, string> = {
  'Data & Productivity': 'bg-green-100 text-green-800',
  'Video Conferencing': 'bg-blue-100 text-blue-800',
  'Legal & Documents': 'bg-purple-100 text-purple-800',
  'Payments': 'bg-yellow-100 text-yellow-800',
  'Scheduling': 'bg-orange-100 text-orange-800',
};

export default function IntegrationsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'connected' | 'not_configured'>('all');

  const filtered = integrations.filter(i => filter === 'all' || i.status === filter);
  const connectedCount = integrations.filter(i => i.status === 'connected').length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-600 mt-2">
          Connect AIP Platform with your tools to streamline deal flow, communications, and document management.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircleIcon className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{connectedCount}</p>
            <p className="text-sm text-gray-500">Connected</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
            <ClockIcon className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{integrations.length - connectedCount}</p>
            <p className="text-sm text-gray-500">Awaiting Setup</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <PuzzleIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{integrations.length}</p>
            <p className="text-sm text-gray-500">Total Available</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-2 mb-6 inline-flex">
        {(['all', 'connected', 'not_configured'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f === 'all' ? 'All' : f === 'connected' ? 'Connected' : 'Not Configured'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filtered.map((integration) => (
          <div key={integration.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-700 flex-shrink-0">
                    {integration.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">{integration.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${categoryColors[integration.category] || 'bg-gray-100 text-gray-800'}`}>
                        {integration.category}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">{integration.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  {integration.status === 'connected' ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
                      <CheckCircleIcon className="w-4 h-4" />
                      Connected
                    </span>
                  ) : (
                    <button
                      onClick={() => setExpandedId(expandedId === integration.id ? null : integration.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                    >
                      {expandedId === integration.id ? 'Hide Guide' : 'Setup Guide'}
                    </button>
                  )}
                  <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
                    Docs
                  </a>
                </div>
              </div>

              {expandedId === integration.id && integration.setupInstructions && (
                <div className="mt-6 border-t border-gray-100 pt-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Setup Instructions</h4>
                  <ol className="space-y-2 mb-4">
                    {integration.setupInstructions.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  {integration.envVars && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Required Railway Env Vars</p>
                      <div className="flex flex-wrap gap-2">
                        {integration.envVars.map((v) => (
                          <code key={v} className="px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs font-mono">{v}</code>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {integration.status === 'connected' && integration.envVars && (
                <div className="mt-4 border-t border-gray-100 pt-4 flex flex-wrap gap-2">
                  {integration.envVars.map((v) => (
                    <span key={v} className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                      <CheckCircleIcon className="w-3 h-3" />{v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <InfoIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">How to activate integrations</h3>
            <p className="text-blue-800 text-sm">
              Obtain API credentials from each service, then add them as environment variables in your{' '}
              <a href="https://railway.app" target="_blank" rel="noopener noreferrer" className="underline font-medium">Railway dashboard</a>{' '}
              under AIP backend service &rsaquo; Variables. The backend will automatically pick up the keys on the next deploy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>);
}
function ClockIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>);
}
function PuzzleIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z" /></svg>);
}
function InfoIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>);
}
