'use client';

import React from 'react';
import { AddExpenseScreen } from './AddExpenseScreen';

interface Member {
  id: string;
  name: string;
  isOwner?: boolean;
}

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName?: string;
  members: Member[];
  onExpenseAdded: (newExpense?: any) => void;
  defaultPayerId?: string;
}

export function AddExpenseModal(props: AddExpenseModalProps) {
  return <AddExpenseScreen {...props} />;
}

export { AddExpenseScreen };
