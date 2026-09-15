'use client';

import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { GROUP_CATEGORIES, getGroupCategoryInfo } from '@/lib/groupIcons';
import { StraightLineLoader } from '@/components/common/StraightLineLoader';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: (group: any) => void;
}

export function CreateGroupModal({ isOpen, onClose, onGroupCreated }: CreateGroupModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Trip');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const currentCategoryInfo = getGroupCategoryInfo(category);
  const CurrentIcon = currentCategoryInfo.icon;

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
          initialMembers: [],
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
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] relative">
        <StraightLineLoader isLoading={loading} />
        {/* Header with larger text */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${currentCategoryInfo.bg} ${currentCategoryInfo.color} flex items-center justify-center font-bold shadow-2xs`}>
              <CurrentIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg leading-tight">New Group</h3>
              <span className="text-[11px] font-semibold text-slate-400">
                Type: {currentCategoryInfo.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
              {error}
            </div>
          )}

          {/* Group Name */}
          <div>
            <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              Group Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Goa Trip, Flat 302, Dinner"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-bold text-slate-900 text-sm bg-slate-50/50 placeholder:text-slate-400"
              autoFocus
            />
          </div>

          {/* Group Icon & Category Horizontal Slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                Group Icon & Theme
              </label>
              <span className="text-[11px] font-bold text-emerald-700">
                {currentCategoryInfo.label}
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto p-2 bg-slate-50/90 rounded-2xl border border-slate-200/80 scroll-smooth snap-x overscroll-x-contain">
              {GROUP_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`w-[70px] py-2.5 px-1.5 rounded-xl flex flex-col items-center gap-1.5 transition-all cursor-pointer relative shrink-0 snap-start select-none ${
                      isSelected
                        ? 'bg-white shadow-xs ring-2 ring-emerald-600 scale-[1.02]'
                        : 'hover:bg-white/70 text-slate-600 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform ${
                        isSelected ? `${cat.bg} ${cat.color} scale-105 shadow-2xs` : `${cat.bg} ${cat.color}`
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-[10px] font-extrabold text-slate-800 truncate w-full text-center leading-tight">
                      {cat.id}
                    </span>
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-xs">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-2xl shadow-xs transition-all text-sm flex items-center justify-center cursor-pointer active:scale-[0.99]"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
