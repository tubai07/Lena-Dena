import { db } from './db';
import { toPaisa, recalculateCustomerBalance } from './ledger';

export async function seedDemoData() {
  console.log('🌱 Seeding personal khata data matching reference screenshots...');

  // 1. Clean up existing demo merchant if exists
  const existingUser = await db.user.findFirst({
    where: { phone: '9830012345' },
    include: { businesses: true },
  });

  if (existingUser) {
    for (const b of existingUser.businesses) {
      await db.business.delete({ where: { id: b.id } });
    }
    await db.user.delete({ where: { id: existingUser.id } });
  }

  // 2. Create User
  const user = await db.user.create({
    data: {
      name: 'Tubai',
      phone: '9830012345',
      email: 'tubai@personal.in',
      passwordHash: 'demo123',
    },
  });

  // 3. Create Personal Business Container
  const business = await db.business.create({
    data: {
      name: 'My Personal Khata',
      category: 'Personal',
      currency: 'INR',
      currencySymbol: '₹',
      upiId: 'tubai@okaxis',
      phone: '9830012345',
      ownerId: user.id,
      settings: {
        create: {
          autoRemindersEnabled: true,
          reminderFrequencyDays: 7,
          reminderTemplate:
            'Hi {customer_name}, gentle reminder that {amount} is pending on our personal khata. Please settle when convenient. Thanks!',
          defaultPaymentMethod: 'UPI',
          preferredLanguage: 'en',
        },
      },
    },
  });

  // 4. Contacts & Transactions exactly matching screenshots
  const contactsData = [
    {
      name: 'Raju',
      phone: '9830111111',
      avatarEmoji: 'R',
      openingBalance: 0,
      transactions: [
        {
          type: 'CREDIT',
          amount: 100,
          date: new Date('2025-02-10T14:30:00Z'),
          desc: 'Chai & Snacks',
        },
      ], // Net balance = ₹100 Due
    },
    {
      name: 'Tanvir',
      phone: '9830222222',
      avatarEmoji: 'T',
      openingBalance: 0,
      transactions: [
        {
          type: 'CREDIT',
          amount: 7000,
          date: new Date('2022-05-15T18:00:00Z'),
          desc: 'Borrowed for travel tickets',
        },
      ], // Net balance = ₹7,000 Due
    },
    {
      name: 'Sibu',
      phone: '9830333333',
      avatarEmoji: 'S',
      openingBalance: 5200,
      transactions: [
        {
          type: 'PAYMENT',
          amount: 5200,
          date: new Date('2026-03-11T21:56:00Z'),
          desc: 'Previous settlement',
        },
        {
          type: 'CREDIT',
          amount: 3000,
          date: new Date('2026-04-24T20:32:00Z'),
          desc: 'Shopping payment',
        },
        {
          type: 'CREDIT',
          amount: 1100,
          date: new Date('2026-04-30T20:07:00Z'),
          desc: 'Drink',
        },
        {
          type: 'PAYMENT',
          amount: 4100,
          date: new Date('2026-09-07T22:00:00Z'),
          desc: 'UPI Transfer',
        },
      ], // Net balance = 0 - 5200 + 3000 + 1100 - 4100 = -5200 or ₹0 depending on opening
    },
    {
      name: 'Babu Mama',
      phone: '9830444444',
      avatarEmoji: 'B',
      openingBalance: 215,
      transactions: [
        {
          type: 'CREDIT',
          amount: 31,
          date: new Date('2026-07-10T16:15:00Z'),
          desc: 'Grocery item',
        },
      ], // Net balance = ₹246 Due
    },
    {
      name: 'Rabbit 🐰',
      phone: '9830555555',
      avatarEmoji: '🐰',
      openingBalance: 18654,
      transactions: [
        {
          type: 'PAYMENT',
          amount: 1356,
          date: new Date('2026-08-28T19:20:00Z'),
          desc: 'Partial repayment via GPay',
        },
      ], // Net balance = 18654 - 1356 = ₹17,298 Due
    },
    {
      name: 'Bappa Da',
      phone: '9830666666',
      avatarEmoji: 'BD',
      openingBalance: 1400,
      transactions: [
        {
          type: 'PAYMENT',
          amount: 1400,
          date: new Date('2026-05-29T11:45:00Z'),
          desc: 'Full cash settlement',
        },
      ], // Net balance = ₹0 Due
    },
  ];

  for (const cData of contactsData) {
    const customer = await db.customer.create({
      data: {
        businessId: business.id,
        name: cData.name,
        phone: cData.phone,
        openingBalancePaisa: toPaisa(cData.openingBalance),
        currentBalancePaisa: toPaisa(cData.openingBalance),
        status: 'ACTIVE',
      },
    });

    for (const txData of cData.transactions) {
      await db.transaction.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          type: txData.type,
          amountPaisa: toPaisa(txData.amount),
          paymentMethod: 'UPI',
          date: txData.date,
          description: txData.desc,
        },
      });
    }

    await recalculateCustomerBalance(customer.id);
  }

  // Realistic notifications
  await db.notification.createMany({
    data: [
      {
        businessId: business.id,
        title: 'Payment Added',
        message: '₹4,100 Payment received from Sibu.',
        type: 'PAYMENT_RECEIVED',
        isRead: false,
      },
      {
        businessId: business.id,
        title: 'Pending Due Alert',
        message: 'Rabbit 🐰 has ₹17,298 pending.',
        type: 'OVERDUE',
        isRead: false,
      },
      {
        businessId: business.id,
        title: 'Collection Pending',
        message: 'Tanvir has ₹7,000 pending collection.',
        type: 'OVERDUE',
        isRead: false,
      },
    ],
  });

  return { user, business };
}
