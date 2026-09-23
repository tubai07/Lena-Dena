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
    return (
      <div className="min-h-screen bg-slate-100/70 sm:py-6 flex justify-center">
        <div className="w-full max-w-md bg-white min-h-screen sm:min-h-[844px] sm:rounded-3xl sm:shadow-2xl sm:border sm:border-slate-200/80 overflow-x-clip flex flex-col relative">
          <div className="flex-1 w-full">{children}</div>
        </div>
      </div>
    );
  }

  let business: any = null;
  let initialCustomers: any[] = [];
  let initialTransactions: any[] = [];

  try {
    const results = await Promise.all([
      db.business.findUnique({
        where: { id: session.businessId },
        include: { owner: true, settings: true },
      }),
      db.customer.findMany({
        where: { businessId: session.businessId },
        orderBy: { currentBalancePaisa: 'desc' },
        include: {
          transactions: {
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          },
        },
      }),
      db.transaction.findMany({
        where: { businessId: session.businessId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          customer: {
            select: { id: true, name: true, phone: true, currentBalancePaisa: true },
          },
        },
        take: 100,
      }),
    ]);
    business = results[0];
    initialCustomers = results[1] || [];
    initialTransactions = results[2] || [];
  } catch (err) {
    console.error('Error fetching dashboard initial data:', err);
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-slate-100/70 sm:py-6 flex justify-center">
        <div className="w-full max-w-md bg-white min-h-screen sm:min-h-[844px] sm:rounded-3xl sm:shadow-2xl sm:border sm:border-slate-200/80 overflow-x-clip flex flex-col relative">
          <div className="flex-1 w-full">{children}</div>
        </div>
      </div>
    );
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
