import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
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

  // Fetch business, initial customers, and recent activity concurrently in 1 parallel query batch
  const [business, initialCustomers, initialTransactions] = await Promise.all([
    db.business.findUnique({
      where: { id: session.businessId },
      include: { owner: true, settings: true },
    }),
    db.customer.findMany({
      where: { businessId: session.businessId },
      orderBy: { currentBalancePaisa: 'desc' },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
        },
      },
    }),
    db.transaction.findMany({
      where: { businessId: session.businessId },
      orderBy: { date: 'desc' },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, currentBalancePaisa: true },
        },
      },
      take: 100,
    }),
  ]);

  if (!business) {
    redirect('/login');
  }

  return (
    <AppProvider
      initialBusiness={business}
      initialCustomers={initialCustomers}
      initialTransactions={initialTransactions}
    >
      <ClientLayoutShell businessName={business.name}>
        {children}
      </ClientLayoutShell>
    </AppProvider>
  );
}
