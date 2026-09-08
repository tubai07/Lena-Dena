'use client';

import React, { useState, useEffect } from 'react';
import {
  BellRing,
  Send,
  MessageCircle,
  Smartphone,
  CheckCircle,
  Clock,
  Settings,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { formatINR } from '@/lib/ledger';
import { formatDate } from '@/lib/utils';
import { useTranslation } from '@/components/common/LanguageContext';

export default function RemindersPage() {
  const { t } = useTranslation();
  const [reminders, setReminders] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
    autoRemindersEnabled: true,
    reminderFrequencyDays: 7,
    reminderTemplate:
      'Namaste {customer_name}, this is a friendly reminder from {business_name} that {amount} is pending on your khata account. Kindly settle the payment at your convenience. UPI ID: {upi_id}. Thank you!',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fetchRemindersData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reminders');
      const data = await res.json();
      if (data.reminders) {
        setReminders(data.reminders);
      }
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRemindersData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoRemindersEnabled: settings.autoRemindersEnabled,
          reminderFrequencyDays: settings.reminderFrequencyDays,
          reminderTemplate: settings.reminderTemplate,
        }),
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const previewMessage = (settings.reminderTemplate || '')
    .replace('{customer_name}', 'Rahul Sharma')
    .replace('{business_name}', 'Tubai General Store')
    .replace('{amount}', '₹12,500')
    .replace('{upi_id}', 'tubai@okaxis');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900">{t.reminders}</h2>
        <p className="text-xs text-slate-500">
          Automated customer payment reminder rules and delivery log
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings & Automation Rules */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Reminder Automation Rules</h3>
                <p className="text-xs text-slate-500">Configure schedule & template</p>
              </div>
            </div>

            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Active
            </span>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            {/* Auto Reminders Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
              <div>
                <span className="font-bold text-slate-900 text-sm block">
                  Enable Automatic Reminders
                </span>
                <span className="text-xs text-slate-500">
                  Prepare follow-up messages for overdue accounts
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoRemindersEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, autoRemindersEnabled: e.target.checked })
                }
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            {/* Reminder Frequency */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Reminder Frequency (Days after due date)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[3, 7, 15, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() =>
                      setSettings({ ...settings, reminderFrequencyDays: days })
                    }
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                      settings.reminderFrequencyDays === days
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {days} Days
                  </button>
                ))}
              </div>
            </div>

            {/* Message Template Editor */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Reminder Message Template
                </label>
                <span className="text-[11px] text-slate-400">Tokens: {'{customer_name}'}, {'{amount}'}, {'{upi_id}'}</span>
              </div>
              <textarea
                rows={4}
                value={settings.reminderTemplate}
                onChange={(e) =>
                  setSettings({ ...settings, reminderTemplate: e.target.value })
                }
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:bg-white focus:border-blue-500 outline-none leading-relaxed resize-none"
              />
            </div>

            {/* Live Message Preview Card */}
            <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-2">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>Live WhatsApp Message Preview:</span>
              </div>
              <p className="text-xs text-emerald-950 font-medium leading-relaxed italic">
                &ldquo;{previewMessage}&rdquo;
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>

              {savedSuccess && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>Settings updated!</span>
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Reminders History Log */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Reminder Log</h3>
              <p className="text-xs text-slate-500">History of dispatched reminders</p>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {reminders.length} Sent
            </span>
          </div>

          <div className="divide-y divide-slate-100 mt-2 max-h-[500px] overflow-y-auto">
            {reminders.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No reminders dispatched yet. Remind customers directly from their profile or dashboard!
              </div>
            ) : (
              reminders.map((r: any) => (
                <div key={r.id} className="py-3.5 hover:bg-slate-50 p-2 rounded-2xl transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{r.customer?.name}</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {formatDate(r.sentAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                    {r.message}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                      {r.channel}
                    </span>
                    <span className="text-[10px] text-slate-400">Status: Sent</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
