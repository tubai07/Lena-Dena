'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Phone,
  QrCode,
  LogOut,
  CheckCircle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useApp } from '@/components/common/AppContext';

export default function PersonalSettingsPage() {
  const router = useRouter();
  const { business, setBusiness, refreshAppData } = useApp();

  // Instant pre-population from in-memory AppContext (0ms delay)
  const [name, setName] = useState(business?.owner?.name || business?.name || '');
  const [phone, setPhone] = useState(business?.phone || business?.owner?.phone || '');
  const [upiId, setUpiId] = useState(business?.upiId || '');

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Direct Password Change State (no old password required)
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Background sync in case any details changed remotely
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.business) {
          setName(data.business.owner?.name || data.business.name || '');
          setPhone(data.business.phone || data.business.owner?.phone || '');
          setUpiId(data.business.upiId || '');
        }
      })
      .catch((e) => console.error(e));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          upiId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedSuccess(true);
        if (data.business && setBusiness) {
          setBusiness(data.business);
        }
        refreshAppData();
        setTimeout(() => setSavedSuccess(false), 2500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setPasswordError('Please enter a new password');
      return;
    }
    if (newPassword.trim().length < 4) {
      setPasswordError('Password should be at least 4 characters');
      return;
    }

    try {
      setSavingPassword(true);
      setPasswordError('');
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword: newPassword.trim(),
        }),
      });
      if (res.ok) {
        setPasswordSuccess(true);
        setNewPassword('');
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        const data = await res.json();
        setPasswordError(data.error || 'Failed to update password');
      }
    } catch (e: any) {
      setPasswordError(e.message || 'Error updating password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white pb-28">
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-1 text-slate-700 hover:text-black tap-effect">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h2 className="font-bold text-slate-900 text-lg">Settings</h2>
        </div>
        <div className="w-6" />
      </header>

      <div className="p-4 space-y-4">
        {/* Personal Profile */}
        <form onSubmit={handleSave} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <User className="w-4 h-4 text-emerald-700" />
            <span>My Profile</span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Mobile Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile number"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">UPI ID (For Reminders)</label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. 9830012345@upi or name@okaxis"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 outline-none focus:border-emerald-600"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 tap-effect"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Save Profile</span>
          </button>

          {savedSuccess && (
            <p className="text-center text-xs font-bold text-emerald-600">Saved successfully!</p>
          )}
        </form>

        {/* Change Password (No Old Password Required) */}
        <form onSubmit={handlePasswordChange} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Lock className="w-4 h-4 text-emerald-700" />
            <span>Change Password</span>
          </div>

          {passwordError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
              {passwordError}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">No old password required. Enter your new password directly.</p>
          </div>

          <button
            type="submit"
            disabled={savingPassword || !newPassword.trim()}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 tap-effect"
          >
            {savingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Update Password</span>
          </button>

          {passwordSuccess && (
            <p className="text-center text-xs font-bold text-emerald-600">Password updated successfully!</p>
          )}
        </form>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-2 tap-effect"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
}
