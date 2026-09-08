'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { QuickActionModal } from '../layout/QuickActionModal';
import { TransactionModal } from '../transaction/TransactionModal';
import { PaymentSuccessModal } from '../transaction/PaymentSuccessModal';
import { CustomerFormModal } from '../customer/CustomerFormModal';
import { SendReminderModal } from '../reminders/SendReminderModal';

interface AppContextType {
  openTransactionModal: (customer?: any, defaultType?: 'CREDIT' | 'PAYMENT') => void;
  openCustomerModal: (customer?: any) => void;
  openReminderModal: (customer: any) => void;
  refreshAppData: () => void;
  lastUpdated: number;
  business: any;
  allCustomers: any[];
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({
  children,
  initialBusiness,
}: {
  children: React.ReactNode;
  initialBusiness?: any;
}) {
  const [business, setBusiness] = useState(initialBusiness || null);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  // Modals state
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'CREDIT' | 'PAYMENT'>('PAYMENT');
  const [activeCustomer, setActiveCustomer] = useState<any>(null);

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);

  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderCustomer, setReminderCustomer] = useState<any>(null);

  const [paymentSuccessOpen, setPaymentSuccessOpen] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<any>(null);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers?filter=all');
      const data = await res.json();
      if (data.customers) {
        setAllCustomers(data.customers);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const refreshAppData = () => {
    setLastUpdated(Date.now());
    fetchCustomers();
  };

  const openTransactionModal = (customer?: any, defaultType: 'CREDIT' | 'PAYMENT' = 'PAYMENT') => {
    setActiveCustomer(customer || null);
    setTransactionType(defaultType);
    setTransactionModalOpen(true);
  };

  const openCustomerModal = (customer?: any) => {
    setEditingCustomer(customer || null);
    setCustomerModalOpen(true);
  };

  const openReminderModal = (customer: any) => {
    setReminderCustomer(customer);
    setReminderModalOpen(true);
  };

  const handleQuickActionSelect = (action: 'CREDIT' | 'PAYMENT' | 'CUSTOMER') => {
    if (action === 'CUSTOMER') {
      openCustomerModal();
    } else {
      openTransactionModal(undefined, action);
    }
  };

  const handleTransactionSuccess = (result: any) => {
    refreshAppData();
    if (result.transaction.type === 'PAYMENT') {
      setPaymentSuccessData({
        customerName: result.customer?.name || 'Customer',
        phone: result.customer?.phone || '',
        businessName: business?.name || 'Tubai General Store',
        amountPaidPaisa: result.amountPaidPaisa || result.transaction.amountPaisa,
        oldBalancePaisa: result.oldBalancePaisa || 0,
        newBalancePaisa: result.newBalancePaisa,
        paymentMethod: result.paymentMethod || 'CASH',
        billNumber: result.transaction.billNumber,
      });
      setPaymentSuccessOpen(true);
    }
  };

  return (
    <AppContext.Provider
      value={{
        openTransactionModal,
        openCustomerModal,
        openReminderModal,
        refreshAppData,
        lastUpdated,
        business,
        allCustomers,
      }}
    >
      {children}

      {/* Quick Action Modal (FAB) */}
      <QuickActionModal
        isOpen={quickActionOpen}
        onClose={() => setQuickActionOpen(false)}
        onSelectAction={handleQuickActionSelect}
      />

      {/* Record Transaction Modal */}
      <TransactionModal
        isOpen={transactionModalOpen}
        onClose={() => setTransactionModalOpen(false)}
        onSuccess={handleTransactionSuccess}
        preSelectedCustomer={activeCustomer}
        defaultType={transactionType}
        allCustomers={allCustomers}
      />

      {/* Customer Form Modal (Add / Edit) */}
      <CustomerFormModal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onSuccess={() => refreshAppData()}
        initialData={editingCustomer}
      />

      {/* Send Payment Reminder Modal */}
      <SendReminderModal
        isOpen={reminderModalOpen}
        onClose={() => setReminderModalOpen(false)}
        customer={reminderCustomer}
        onReminderLogged={() => refreshAppData()}
      />

      {/* Payment Success Confetti Modal */}
      <PaymentSuccessModal
        isOpen={paymentSuccessOpen}
        onClose={() => setPaymentSuccessOpen(false)}
        data={paymentSuccessData}
      />
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
