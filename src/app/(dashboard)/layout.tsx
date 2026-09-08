import React from 'react';
import { getCurrentBusiness } from '@/lib/auth';
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
  const business = await getCurrentBusiness();

  return (
    <AppProvider initialBusiness={business}>
      <ClientLayoutShell businessName={business?.name || 'Tubai General Store'}>
        {children}
      </ClientLayoutShell>
    </AppProvider>
  );
}
