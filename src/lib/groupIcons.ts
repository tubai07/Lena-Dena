import {
  Palmtree,
  Home,
  Utensils,
  ShoppingCart,
  Coffee,
  PartyPopper,
  Car,
  Trophy,
  Briefcase,
  Heart,
  Gamepad2,
  Sparkles,
  Plane,
  Users,
  LucideIcon,
} from 'lucide-react';

export interface GroupCategoryInfo {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;     // Text color
  bg: string;        // Light background
  badgeBg: string;   // Full button / badge color
  border: string;    // Border color
}

export const GROUP_CATEGORIES: GroupCategoryInfo[] = [
  {
    id: 'Trip',
    label: 'Trip / Vacation',
    icon: Palmtree,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    badgeBg: 'bg-emerald-600 text-white',
    border: 'border-emerald-200',
  },
  {
    id: 'Home',
    label: 'Flat / Roommates',
    icon: Home,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    badgeBg: 'bg-blue-600 text-white',
    border: 'border-blue-200',
  },
  {
    id: 'Dining',
    label: 'Food & Dining',
    icon: Utensils,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    badgeBg: 'bg-amber-600 text-white',
    border: 'border-amber-200',
  },
  {
    id: 'Groceries',
    label: 'Groceries',
    icon: ShoppingCart,
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    badgeBg: 'bg-teal-600 text-white',
    border: 'border-teal-200',
  },
  {
    id: 'Cafe',
    label: 'Cafe & Drinks',
    icon: Coffee,
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    badgeBg: 'bg-rose-600 text-white',
    border: 'border-rose-200',
  },
  {
    id: 'Party',
    label: 'Party & Outing',
    icon: PartyPopper,
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    badgeBg: 'bg-purple-600 text-white',
    border: 'border-purple-200',
  },
  {
    id: 'Transport',
    label: 'Travel & Taxi',
    icon: Car,
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    badgeBg: 'bg-sky-600 text-white',
    border: 'border-sky-200',
  },
  {
    id: 'Flight',
    label: 'Flights & Tour',
    icon: Plane,
    color: 'text-cyan-700',
    bg: 'bg-cyan-50',
    badgeBg: 'bg-cyan-600 text-white',
    border: 'border-cyan-200',
  },
  {
    id: 'Sports',
    label: 'Sports & Games',
    icon: Trophy,
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    badgeBg: 'bg-orange-600 text-white',
    border: 'border-orange-200',
  },
  {
    id: 'Work',
    label: 'Office & Work',
    icon: Briefcase,
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    badgeBg: 'bg-slate-700 text-white',
    border: 'border-slate-200',
  },
  {
    id: 'Couple',
    label: 'Couple & Family',
    icon: Heart,
    color: 'text-pink-700',
    bg: 'bg-pink-50',
    badgeBg: 'bg-pink-600 text-white',
    border: 'border-pink-200',
  },
  {
    id: 'Gaming',
    label: 'Gaming & Fun',
    icon: Gamepad2,
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    badgeBg: 'bg-violet-600 text-white',
    border: 'border-violet-200',
  },
  {
    id: 'General',
    label: 'General / Other',
    icon: Sparkles,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    badgeBg: 'bg-emerald-600 text-white',
    border: 'border-emerald-200',
  },
];

export function getGroupCategoryInfo(categoryId?: string | null): GroupCategoryInfo {
  if (!categoryId) return GROUP_CATEGORIES[0];
  const normalized = categoryId.trim().toLowerCase();
  const match = GROUP_CATEGORIES.find(
    (c) =>
      c.id.toLowerCase() === normalized ||
      c.label.toLowerCase().includes(normalized) ||
      normalized.includes(c.id.toLowerCase())
  );
  return match || GROUP_CATEGORIES[0];
}
