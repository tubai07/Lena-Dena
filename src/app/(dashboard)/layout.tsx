import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentBusiness, getSession } from '@/lib/auth';
import { DesktopSidebar } from '@/components/layout/DesktopSidebar';
import { TopNavBar } from '@/components/layout/TopNavBar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { AppProvider } from '@/components/common/AppContext';
import { ClientLayoutShell } from '@/components/layout/ClientLayoutShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.businessId) {
    redirect('/login');
  }

  const business = await getCurrentBusiness();
  if (!business) {
    redirect('/login');
  }

  return (
    <AppProvider initialBusiness={business}>
      <ClientLayoutShell businessName={business.name}>
        {children}
      </ClientLayoutShell>
    </AppProvider>
  );
}
