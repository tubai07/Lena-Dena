'use client';

import React, { useState } from 'react';
import { X, Plus, Users, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: (group: any) => void;
}

const CATEGORIES = [
  { label: 'Trip 🏖️', value: 'Trip' },
  { label: 'Home / Flatmates 🏠', value: 'Home' },
  { label: 'Dining / Food 🍕', value: 'Dining' },
  { label: 'Event / Party 🎂', value: 'Event' },
  { label: 'Other ⚡', value: 'Other' },
];

export function CreateGroupModal({ isOpen, onClose, onGroupCreated }: CreateGroupModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Trip');
  const [memberName, setMemberName] = useState('');
  const [members, setMembers] = useState<{ name: string; phone?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAddMemberChip = () => {
    const trimmed = memberName.trim();
    if (!trimmed) return;
    if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('Member already added');
      return;
    }
    setMembers([...members, { name: trimmed }]);
    setMemberName('');
    setError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddMemberChip();
    }
  };

  const handleRemoveMember = (idx: number) => {
    setMembers(members.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a group name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          initialMembers: members,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create group');
      }

      onClose();
      if (onGroupCreated) {
        onGroupCreated(data.group);
      } else {
        router.push(`/groups/${data.group.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">Create New Group</h3>
              <p className="text-xs text-slate-500">Trip, flatmates, or shared dinner bill</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
              {error}
            </div>
          )}

          {/* Group Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Group Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Goa Trip 2026, Flat 302, Friday Dinner"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 text-sm bg-slate-50/50"
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    category === cat.value
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Add Members */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Group Members
              </label>
              <span className="text-[11px] text-slate-400">You are automatically added</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type friend's name (e.g. Rahul)"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-900 bg-slate-50/50"
              />
              <button
                type="button"
                onClick={handleAddMemberChip}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-2xl transition-colors flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {/* Added Members Chips */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                You (Creator)
              </span>

              {members.map((m, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-full text-xs font-bold animate-in zoom-in-95 duration-150"
                >
                  {m.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(idx)}
                    className="hover:text-rose-600 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              💡 Tip: You can also invite friends later with your 5-character Join Code.
            </p>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                'Creating Group...'
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Create Group & Get Join Code
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
