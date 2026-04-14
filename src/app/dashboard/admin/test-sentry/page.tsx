'use client';

import { useState } from 'react';
import AdminGuard from '@/components/AdminGuard';
import * as Sentry from '@sentry/nextjs';

function TestSentryContent() {
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [backendStatus, setBackendStatus] = useState<string | null>(null);

  const triggerFrontendError = () => {
    try {
      throw new Error('AIP Frontend Sentry Test — triggered from admin panel');
    } catch (err) {
      Sentry.captureException(err);
      setStatus('sent');
    }
  };

  const triggerBackendError = async () => {
    try {
      const r = await fetch('/api/debug/test-sentry', { method: 'POST' });
      const data = await r.json();
      setBackendStatus(data.message ?? JSON.stringify(data));
    } catch (err) {
      setBackendStatus(`Request failed: ${err}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Sentry Integration Test</h1>
      <p className="text-gray-600 mb-8">
        Use these buttons to verify that Sentry error capture is working correctly.
        Check your{' '}
        <a
          href="https://sentry.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          Sentry dashboard
        </a>{' '}
        within 60 seconds of triggering.
      </p>

      <div className="space-y-4">
        {/* Frontend test */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Frontend Error Capture</h2>
          <p className="text-sm text-gray-500 mb-4">
            Calls <code>Sentry.captureException()</code> directly in the browser.
          </p>
          <button
            onClick={triggerFrontendError}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium px-4 py-2 rounded-lg transition"
          >
            Trigger Frontend Test Error
          </button>
          {status === 'sent' && (
            <p className="mt-3 text-sm text-green-700 font-medium">
              ✓ Exception sent to Sentry (frontend). Check your dashboard.
            </p>
          )}
        </div>

        {/* Backend test */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Backend Error Capture</h2>
          <p className="text-sm text-gray-500 mb-4">
            Calls <code>POST /api/debug/test-sentry</code> — triggers a backend exception.
          </p>
          <button
            onClick={triggerBackendError}
            className="bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition"
          >
            Trigger Backend Test Error
          </button>
          {backendStatus && (
            <p className="mt-3 text-sm text-gray-700">{backendStatus}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TestSentryPage() {
  return (
    <AdminGuard>
      <TestSentryContent />
    </AdminGuard>
  );
}
