'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { QuickActionModal } from '../layout/QuickActionModal';
import { TransactionModal } from '../transaction/TransactionModal';
import { PaymentSuccessModal } from '../transaction/PaymentSuccessModal';
import { CustomerFormModal } from '../customer/CustomerFormModal';
import { SendReminderModal } from '../reminders/SendReminderModal';
import { pendingCustomerCreations } from '@/lib/utils';

interface AppContextType {
  openTransactionModal: (customer?: any, defaultType?: 'CREDIT' | 'PAYMENT') => void;
  openCustomerModal: (customer?: any) => void;
  openReminderModal: (customer: any) => void;
  refreshAppData: () => void;
  lastUpdated: number;
  business: any;
  setBusiness: React.Dispatch<React.SetStateAction<any>>;
  allCustomers: any[];
  setAllCustomers: React.Dispatch<React.SetStateAction<any[]>>;
  allTransactions: any[];
  setAllTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  deleteCustomerFromApp: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({
  children,
  initialBusiness,
  initialCustomers = [],
  initialTransactions = [],
}: {
  children: React.ReactNode;
  initialBusiness?: any;
  initialCustomers?: any[];
  initialTransactions?: any[];
}) {
  const [business, setBusiness] = useState(initialBusiness || null);
  const [allCustomers, setAllCustomers] = useState<any[]>(initialCustomers || []);
  const [allTransactions, setAllTransactions] = useState<any[]>(initialTransactions || []);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const deletedCustomerIdsRef = useRef<Set<string>>(new Set());

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
        setAllCustomers((prev) => {
          const serverCustomers = data.customers.filter((c: any) => !deletedCustomerIdsRef.current.has(c.id));
          const serverIds = new Set(serverCustomers.map((c: any) => c.id));
          // CRITICAL: Preserve any optimistic / in-flight customers that haven't yet been returned by the DB query
          const pendingOptimistic = prev.filter(
            (c) => (pendingCustomerCreations.has(c.id) || c.isOptimistic) && !serverIds.has(c.id) && !deletedCustomerIdsRef.current.has(c.id)
          );
          return [...pendingOptimistic, ...serverCustomers];
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteCustomerFromApp = async (id: string) => {
    // 1. Immediately register in deleted IDs set (prevents race-condition resurrections forever)
    deletedCustomerIdsRef.current.add(id);

    // 2. Instant optimistic removal from UI (0ms delay)
    setAllCustomers((prev) => prev.filter((c) => c.id !== id));
    setAllTransactions((prev) => prev.filter((t) => t.customerId !== id && t.customer?.id !== id));

    // 3. Persist deletion on server
    try {
      await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to delete customer on server:', e);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/transactions');
      const data = await res.json();
      if (data.transactions) {
        setAllTransactions(data.transactions);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBusiness = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.business) {
        setBusiness(data.business);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!initialCustomers || initialCustomers.length === 0) {
      fetchCustomers();
    }
    if (!initialTransactions || initialTransactions.length === 0) {
      fetchTransactions();
    }
  }, []);

  const refreshAppData = () => {
    setLastUpdated(Date.now());
    fetchCustomers();
    fetchTransactions();
    fetchBusiness();
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
    const isTemp = Boolean(result.transaction?.id?.startsWith('temp_tx_'));

    // Instant optimistic in-memory balance update
    if (result.newBalancePaisa !== undefined && (result.customer?.id || result.transaction?.customerId)) {
      const targetId = result.customer?.id || result.transaction?.customerId;
      setAllCustomers((prev) =>
        prev.map((c) => {
          if (c.id === targetId) {
            const existingTxs = c.transactions || [];
            let newTxs: any[];
            if (isTemp) {
              newTxs = [result.transaction, ...existingTxs];
            } else {
              const tempIndex = existingTxs.findIndex((t: any) => t.id?.startsWith('temp_tx_'));
              if (tempIndex >= 0) {
                newTxs = [...existingTxs];
                newTxs[tempIndex] = result.transaction;
              } else if (!existingTxs.some((t: any) => t.id === result.transaction.id)) {
                newTxs = [result.transaction, ...existingTxs];
              } else {
                newTxs = existingTxs;
              }
            }
            return {
              ...c,
              currentBalancePaisa: result.newBalancePaisa,
              transactions: newTxs,
            };
          }
          return c;
        })
      );
    }

    // Instant optimistic update to Activity (allTransactions)
    if (result.transaction) {
      setAllTransactions((prev) => {
        const txWithCustomer = {
          ...result.transaction,
          customer: result.customer || prev.find((t) => t.customer?.id === result.transaction.customerId)?.customer,
        };
        if (isTemp) {
          return [txWithCustomer, ...prev];
        }
        const tempIndex = prev.findIndex((t) => t.id?.startsWith('temp_tx_'));
        if (tempIndex >= 0) {
          const updated = [...prev];
          updated[tempIndex] = txWithCustomer;
          return updated;
        }
        if (prev.some((t) => t.id === result.transaction.id)) {
          return prev;
        }
        return [txWithCustomer, ...prev];
      });
    }

    // CRITICAL: Only trigger background sync when the transaction is actually persisted in DB.
    // Triggering refreshAppData while POST is in-flight causes a race condition where stale DB data
    // overwrites the optimistic state, making transactions disappear and bounce up and down.
    if (!isTemp) {
      refreshAppData();
    }

    if (result.transaction.type === 'PAYMENT' && isTemp) {
      setPaymentSuccessData({
        customerName: result.customer?.name || 'Customer',
        phone: result.customer?.phone || '',
        businessName: business?.name || 'Lena Dena',
        amountPaidPaisa: result.amountPaidPaisa || result.transaction.amountPaisa,
        oldBalancePaisa: result.oldBalancePaisa || 0,
        newBalancePaisa: result.newBalancePaisa,
        paymentMethod: result.paymentMethod || 'UPI',
        billNumber: result.transaction.billNumber,
      });
      setPaymentSuccessOpen(true);
    }
  };

  const handleCustomerSaved = (savedCustomer: any) => {
    if (!savedCustomer) {
      refreshAppData();
      return;
    }

    // Instant in-memory state update (0ms delay)
    setAllCustomers((prev) => {
      const existsIndex = prev.findIndex((c) => c.id === savedCustomer.id);
      if (existsIndex >= 0) {
        const updated = [...prev];
        updated[existsIndex] = { ...updated[existsIndex], ...savedCustomer };
        return updated;
      }
      // If temp id exists, replace it
      const tempIndex = prev.findIndex((c) => c.id.startsWith('temp_') && c.name === savedCustomer.name);
      if (tempIndex >= 0) {
        const updated = [...prev];
        updated[tempIndex] = { ...savedCustomer, transactions: savedCustomer.transactions || [] };
        return updated;
      }
      return [
        {
          ...savedCustomer,
          transactions: savedCustomer.transactions || [],
        },
        ...prev,
      ];
    });

    // If opening balance created transactions, update allTransactions immediately
    if (savedCustomer.transactions && savedCustomer.transactions.length > 0) {
      setAllTransactions((prev) => {
        const newTxs = savedCustomer.transactions.map((tx: any) => ({
          ...tx,
          customer: {
            id: savedCustomer.id,
            name: savedCustomer.name,
            phone: savedCustomer.phone,
            currentBalancePaisa: savedCustomer.currentBalancePaisa,
          },
        }));
        return [...newTxs, ...prev];
      });
    }

    // Only trigger background refresh if customer is confirmed saved in DB (not in-flight optimistic)
    if (!savedCustomer.isOptimistic) {
      refreshAppData();
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
        setBusiness,
        allCustomers,
        setAllCustomers,
        allTransactions,
        setAllTransactions,
        deleteCustomerFromApp,
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
        onSuccess={handleCustomerSaved}
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
