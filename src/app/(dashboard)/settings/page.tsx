'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Phone,
  QrCode,
  Globe,
  LogOut,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { useTranslation } from '@/components/common/LanguageContext';
import { Language } from '@/lib/i18n';

export default function PersonalSettingsPage() {
  const router = useRouter();
  const { lang, setLang } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.business) {
          setName(data.business.owner?.name || data.business.name || 'Tubai');
          setPhone(data.business.phone || '9830012345');
          setUpiId(data.business.upiId || 'tubai@okaxis');
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
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white pb-24">
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
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Mobile Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">UPI ID (For Reminders)</label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. yourname@okaxis"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 outline-none focus:border-emerald-600"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Save Profile</span>
          </button>

          {savedSuccess && (
            <p className="text-center text-xs font-bold text-emerald-600">Saved successfully!</p>
          )}
        </form>

        {/* Language Selection */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Globe className="w-4 h-4 text-emerald-700" />
            <span>Language</span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { code: 'en', label: 'English' },
              { code: 'hi', label: 'हिन्दी' },
              { code: 'bn', label: 'বাংলা' },
            ].map((item) => (
              <button
                key={item.code}
                onClick={() => setLang(item.code as Language)}
                className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all ${
                  lang === item.code
                    ? 'bg-emerald-100 border-emerald-600 text-emerald-800 font-black'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>



        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
}
