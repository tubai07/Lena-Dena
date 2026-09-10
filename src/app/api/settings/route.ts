import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hashPassword } from '@/lib/security';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await db.business.findUnique({
      where: { id: session.businessId },
      include: { owner: true, settings: true },
    });

    return NextResponse.json({ business });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session?.businessId) {
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

    // Update user profile and/or change password
    if (session.userId) {
      const userUpdates: any = {};
      if (name) userUpdates.name = name.trim();
      if (phone) userUpdates.phone = phone.trim();
      if (body.newPassword && body.newPassword.trim()) {
        if (body.newPassword.trim().length < 6) {
          return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
        }
        userUpdates.passwordHash = await hashPassword(body.newPassword.trim());
      }

      if (Object.keys(userUpdates).length > 0) {
        await db.user.update({
          where: { id: session.userId },
          data: userUpdates,
        });
      }
    }

    // Update business profile
    const updatedBusiness = await db.business.update({
      where: { id: session.businessId },
      data: {
        ...(name && { name: name.trim() }),
        ...(category && { category }),
        ...(upiId !== undefined && { upiId: upiId?.trim() || null }),
        ...(phone && { phone: phone.trim() }),
        ...(address !== undefined && { address: address?.trim() || null }),
      },
      include: { owner: true, settings: true },
    });

    // Update or create settings
    const updatedSettings = await db.businessSettings.upsert({
      where: { businessId: session.businessId },
      create: {
        businessId: session.businessId,
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
