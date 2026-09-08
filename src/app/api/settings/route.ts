import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentBusiness } from '@/lib/auth';

export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ business });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      category,
      upiId,
      phone,
      address,
      autoRemindersEnabled,
      reminderFrequencyDays,
      reminderTemplate,
      defaultPaymentMethod,
      preferredLanguage,
    } = body;

    // Update business profile
    const updatedBusiness = await db.business.update({
      where: { id: business.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(category && { category }),
        ...(upiId !== undefined && { upiId: upiId?.trim() || null }),
        ...(phone && { phone: phone.trim() }),
        ...(address !== undefined && { address: address?.trim() || null }),
      },
    });

    // Update or create settings
    const updatedSettings = await db.businessSettings.upsert({
      where: { businessId: business.id },
      create: {
        businessId: business.id,
        autoRemindersEnabled: autoRemindersEnabled ?? true,
        reminderFrequencyDays: reminderFrequencyDays ? Number(reminderFrequencyDays) : 7,
        reminderTemplate: reminderTemplate || undefined,
        defaultPaymentMethod: defaultPaymentMethod || 'CASH',
        preferredLanguage: preferredLanguage || 'en',
      },
      update: {
        ...(autoRemindersEnabled !== undefined && { autoRemindersEnabled }),
        ...(reminderFrequencyDays && { reminderFrequencyDays: Number(reminderFrequencyDays) }),
        ...(reminderTemplate && { reminderTemplate }),
        ...(defaultPaymentMethod && { defaultPaymentMethod }),
        ...(preferredLanguage && { preferredLanguage }),
      },
    });

    return NextResponse.json({
      success: true,
      business: updatedBusiness,
      settings: updatedSettings,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update settings' }, { status: 500 });
  }
}
