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
  Mail,
  KeyRound,
  X,
} from 'lucide-react';
import { useApp } from '@/components/common/AppContext';

export default function PersonalSettingsPage() {
  const router = useRouter();
  const { business, setBusiness, refreshAppData } = useApp();

  // Instant pre-population from in-memory AppContext (0ms delay)
  const [name, setName] = useState(business?.owner?.name || business?.name || '');
  const [phone, setPhone] = useState(business?.phone || business?.owner?.phone || '');
  const [email, setEmail] = useState(business?.owner?.email || '');
  const [upiId, setUpiId] = useState(business?.upiId || '');

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Direct Password Change State (no old password required)
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Email Change State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailStep, setEmailStep] = useState<'input' | 'otp'>('input');
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailCooldown, setEmailCooldown] = useState(0);

  const startEmailCooldown = () => {
    setEmailCooldown(30);
    const timer = setInterval(() => {
      setEmailCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Background sync in case any details changed remotely
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.business) {
          setName(data.business.owner?.name || data.business.name || '');
          setPhone(data.business.phone || data.business.owner?.phone || '');
          setEmail(data.business.owner?.email || '');
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
    if (newPassword.trim().length < 6) {
      setPasswordError('Password should be at least 6 characters');
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

  const handleSendEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      setEmailError('Please enter a valid email address');
      return;
    }
    try {
      setEmailLoading(true);
      setEmailError('');
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-otp',
          newEmail: newEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

      setEmailStep('otp');
      startEmailCooldown();
    } catch (err: any) {
      setEmailError(err.message || 'Something went wrong');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOtp.trim()) {
      setEmailError('Please enter the OTP');
      return;
    }
    try {
      setEmailLoading(true);
      setEmailError('');
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-otp',
          newEmail: newEmail.trim(),
          otp: emailOtp.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify OTP');

      setEmail(data.email || newEmail.trim());
      if (business && setBusiness) {
        setBusiness({
          ...business,
          owner: {
            ...business.owner,
            email: data.email || newEmail.trim(),
          },
        });
      }
      setEmailSuccess('Email updated successfully!');
      setTimeout(() => {
        setShowEmailModal(false);
        setEmailStep('input');
        setNewEmail('');
        setEmailOtp('');
        setEmailSuccess('');
      }, 1500);
    } catch (err: any) {
      setEmailError(err.message || 'Invalid or expired OTP');
    } finally {
      setEmailLoading(false);
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

        {/* Email Address Section */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Mail className="w-4 h-4 text-emerald-700" />
              <span>Email Address</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowEmailModal(true);
                setEmailStep('input');
                setNewEmail('');
                setEmailOtp('');
                setEmailError('');
                setEmailSuccess('');
              }}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
            >
              Change Email
            </button>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="text-[11px] font-bold text-slate-400">Registered Email</div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5 truncate">
                {email || 'No email attached'}
              </div>
            </div>
            <span className="shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {email ? 'Verified' : 'Pending'}
            </span>
          </div>
        </div>

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

      {/* Change Email Modal with Supabase OTP */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Change Email Address</h3>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {emailError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
                {emailError}
              </div>
            )}

            {emailSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
                {emailSuccess}
              </div>
            )}

            {emailStep === 'input' && !emailSuccess && (
              <form onSubmit={handleSendEmailOtp} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    New Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="new@example.com"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:bg-white focus:border-emerald-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    We will send a 6-digit OTP code to this email to verify ownership.
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={emailLoading || !newEmail.trim()}
                    className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {emailLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Send OTP</span>
                  </button>
                </div>
              </form>
            )}

            {emailStep === 'otp' && !emailSuccess && (
              <form onSubmit={handleVerifyEmailOtp} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-500">
                      Enter 6-Digit OTP
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailStep('input');
                        setEmailError('');
                      }}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Change email
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value.replace(/\s+/g, ''))}
                      placeholder="123456"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold tracking-widest text-slate-900 outline-none focus:bg-white focus:border-emerald-600"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px]">
                    <span className="text-slate-400">Didn't receive code?</span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (emailCooldown > 0 || emailLoading) return;
                        try {
                          setEmailLoading(true);
                          setEmailError('');
                          const res = await fetch('/api/settings/email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'send-otp', newEmail: newEmail.trim() }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || 'Failed to resend OTP');
                          startEmailCooldown();
                        } catch (err: any) {
                          setEmailError(err.message || 'Failed to resend');
                        } finally {
                          setEmailLoading(false);
                        }
                      }}
                      disabled={emailCooldown > 0 || emailLoading}
                      className="font-bold text-emerald-700 hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      {emailCooldown > 0 ? `Resend in ${emailCooldown}s` : 'Resend'}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={emailLoading || !emailOtp.trim()}
                    className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {emailLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Verify & Save</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
