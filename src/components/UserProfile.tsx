import { useState } from 'react';
import { X, User, Lock, Cloud, CloudOff, LogOut, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';

interface Props {
  onClose: () => void;
}

export default function UserProfile({ onClose }: Props) {
  const { user, signOut, updateProfile, changePassword, isCloudEnabled } = useAuth();
  const { syncWithCloud, loadFromCloud } = useApp();

  // Profile fields
  const [name, setName]         = useState(user?.name ?? '');
  const [profileMsg, setProfileMsg] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password fields
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [pwMsg, setPwMsg]           = useState('');
  const [pwError, setPwError]       = useState('');
  const [savingPw, setSavingPw]     = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingProfile(true);
    await updateProfile(name.trim());
    setSavingProfile(false);
    setProfileMsg('Profile updated.');
    setTimeout(() => setProfileMsg(''), 2500);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg('');
    setPwError('');
    if (newPw !== confirmPw) { setPwError('New passwords do not match.'); return; }
    setSavingPw(true);
    const err = await changePassword(currentPw, newPw);
    setSavingPw(false);
    if (err) { setPwError(err); return; }
    setPwMsg('Password changed successfully.');
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setTimeout(() => setPwMsg(''), 2500);
  }

  async function handleSync() {
    setSyncing(true);
    await syncWithCloud();
    setSyncing(false);
  }

  function handleSignOut() {
    signOut();
    onClose();
  }

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50';
  const sectionCls = 'bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden';

  if (!user) return null;

  const initials = user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-semibold text-slate-900">Account Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Avatar + email */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 truncate">{user.name}</p>
              <p className="text-sm text-slate-400 truncate">{user.email}</p>
            </div>
            {/* Cloud badge */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
              isCloudEnabled
                ? 'bg-green-50 text-green-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {isCloudEnabled
                ? <><Cloud size={11} />Cloud</>
                : <><CloudOff size={11} />Local</>}
            </div>
          </div>

          {/* Profile section */}
          <div className={sectionCls}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
              <User size={15} className="text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-700">Profile</h3>
            </div>
            <form onSubmit={handleSaveProfile} className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={inputCls}
                  disabled={savingProfile}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
                />
              </div>
              {profileMsg && (
                <p className="text-green-600 text-xs flex items-center gap-1">
                  <CheckCircle size={11} />{profileMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingProfile && <Loader2 size={13} className="animate-spin" />}
                Save Changes
              </button>
            </form>
          </div>

          {/* Password section */}
          <div className={sectionCls}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
              <Lock size={15} className="text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-700">Password</h3>
            </div>
            <form onSubmit={handleChangePassword} className="px-5 py-4 space-y-3">
              {/* Current password — only shown in local mode */}
              {!isCloudEnabled && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPw}
                    onChange={e => { setCurrentPw(e.target.value); setPwError(''); }}
                    placeholder="••••••••"
                    className={inputCls}
                    disabled={savingPw}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={e => { setNewPw(e.target.value); setPwError(''); }}
                  placeholder="Min. 6 characters"
                  className={inputCls}
                  disabled={savingPw}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={e => { setConfirmPw(e.target.value); setPwError(''); }}
                  placeholder="Repeat new password"
                  className={inputCls}
                  disabled={savingPw}
                />
              </div>
              {isCloudEnabled && (
                <p className="text-xs text-slate-400 italic">
                  Your identity is verified via your active session.
                </p>
              )}
              {pwError && <p className="text-red-500 text-xs">{pwError}</p>}
              {pwMsg && (
                <p className="text-green-600 text-xs flex items-center gap-1">
                  <CheckCircle size={11} />{pwMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={savingPw}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingPw && <Loader2 size={13} className="animate-spin" />}
                Change Password
              </button>
            </form>
          </div>

          {/* Data Sync section */}
          <div className={sectionCls}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
              <Cloud size={15} className="text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-700">Data Sync</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              {isCloudEnabled ? (
                <>
                  <p className="text-xs text-slate-500">
                    Your account is cloud-enabled. Sign in on any device and your data stays in sync.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {syncing ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />}
                      {syncing ? 'Syncing…' : 'Sync Now'}
                    </button>
                    <button
                      onClick={loadFromCloud}
                      className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                      Load from Cloud
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-500">
                    Running in local-only mode. Your data is stored on this device only. To enable
                    cross-device sync, connect a Supabase project via environment variables.
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled
                      className="px-4 py-2 border border-slate-200 text-slate-400 rounded-lg text-sm font-medium cursor-not-allowed opacity-60"
                    >
                      Sync Now
                    </button>
                    <button
                      disabled
                      className="px-4 py-2 border border-slate-200 text-slate-400 rounded-lg text-sm font-medium cursor-not-allowed opacity-60"
                    >
                      Load from Cloud
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 italic">
                    Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cloud sync.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
          >
            <LogOut size={14} />Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
