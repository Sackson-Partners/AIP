'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRBAC, USER_ROLES, UserRole } from '@/hooks/useRBAC';
import { supabase } from '@/lib/supabase';

const ROLE_BADGE_COLORS: Record<string, string> = {
  super_admin:        'bg-red-600',
  private_fund:       'bg-teal-600',
  dfi:                'bg-blue-600',
  epc_contractor:     'bg-yellow-600',
  government:         'bg-green-600',
  academic:           'bg-purple-600',
  journalist_analyst: 'bg-gray-500',
  investor:           'bg-orange-500',
};

const COUNTRIES = [
  'Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde',
  'Cameroon','Central African Republic','Chad','Comoros','DRC','Congo',
  'Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia',
  'Gabon','Gambia','Ghana','Guinea','Guinea-Bissau','Ivory Coast','Kenya',
  'Lesotho','Liberia','Libya','Madagascar','Malawi','Mali','Mauritania',
  'Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria','Rwanda',
  'São Tomé and Príncipe','Senegal','Sierra Leone','Somalia','South Africa',
  'South Sudan','Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe',
  'United Kingdom','United States','France','Germany','China','India','Other',
];

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const { role } = useRBAC();

  const roleInfo = USER_ROLES[role as UserRole];

  const [form, setForm] = useState({
    full_name:    profile?.full_name    ?? '',
    organization: profile?.organization ?? '',
    phone:        profile?.phone        ?? '',
    country:      profile?.country      ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Keep form in sync if profile loads after mount
  useEffect(() => {
    if (profile) {
      setForm({
        full_name:    profile.full_name    ?? '',
        organization: profile.organization ?? '',
        phone:        profile.phone        ?? '',
        country:      profile.country      ?? '',
      });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveMsg(null);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name:    form.full_name    || null,
        organization: form.organization || null,
        phone:        form.phone        || null,
        country:      form.country      || null,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      setSaveMsg({ type: 'error', text: error.message });
    } else {
      setSaveMsg({ type: 'success', text: 'Profile updated successfully.' });
      setTimeout(() => setSaveMsg(null), 4000);
    }
    setSaving(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (pwForm.next.length < 8) {
      setPwMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pwForm.next });
    if (error) {
      setPwMsg({ type: 'error', text: error.message });
    } else {
      setPwMsg({ type: 'success', text: 'Password updated successfully.' });
      setPwForm({ current: '', next: '', confirm: '' });
      setTimeout(() => setPwMsg(null), 4000);
    }
    setPwSaving(false);
  };

  const field = (label: string, name: keyof typeof form, type: string = 'text', placeholder: string = '') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold transition-colors"
      />
    </div>
  );

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-6">My Profile</h1>

      {/* Account overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-gold/20 border-2 border-brand-gold/40 flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-brand-gold">
              {(form.full_name || user?.email || 'U').charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">{form.full_name || user?.email}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              {roleInfo && (
                <span className={`inline-block text-xs text-white px-2 py-0.5 rounded font-medium ${ROLE_BADGE_COLORS[role] ?? 'bg-gray-500'}`}>
                  {roleInfo.label}
                </span>
              )}
              {profile?.is_verified && (
                <span className="inline-block text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded font-medium">
                  Verified
                </span>
              )}
              {profile?.is_active === false && (
                <span className="inline-block text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded font-medium">
                  Inactive
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Subscription</span>
            <p className="font-medium text-gray-900 capitalize">{profile?.subscription_tier ?? 'Free'}</p>
          </div>
          <div>
            <span className="text-gray-500">Member since</span>
            <p className="font-medium text-gray-900">
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Edit profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-brand-navy mb-4">Account Information</h2>
        <form onSubmit={handleSave} className="space-y-4">
          {field('Full Name', 'full_name', 'text', 'Your full name')}
          {field('Organization', 'organization', 'text', 'Your organization')}
          {field('Phone', 'phone', 'tel', '+1 234 567 890')}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <select
              value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold transition-colors"
            >
              <option value="">Select country...</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {saveMsg && (
            <div className={`p-3 rounded-lg text-sm ${saveMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {saveMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-brand-gold hover:bg-brand-gold-dark disabled:opacity-60 text-brand-navy font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-brand-navy mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={pwForm.next}
              onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold transition-colors"
            />
          </div>

          {pwMsg && (
            <div className={`p-3 rounded-lg text-sm ${pwMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {pwMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={pwSaving || !pwForm.next}
            className="px-5 py-2.5 bg-brand-navy hover:bg-brand-navy-light disabled:opacity-60 text-white font-semibold rounded-lg transition-colors"
          >
            {pwSaving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
