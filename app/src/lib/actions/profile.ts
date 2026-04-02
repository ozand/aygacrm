"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

export async function getProfile() {
  const user = await getCurrentUser();

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    nameOrder: user.nameOrder,
    dateFormat: user.dateFormat,
    timezone: user.timezone,
    numberFormat: user.numberFormat,
    distanceFormat: user.distanceFormat,
    defaultMapSite: user.defaultMapSite,
    locale: user.locale,
  };
}

export async function updateProfile(data: {
  firstName?: string;
  lastName?: string;
  nameOrder?: string;
  dateFormat?: string;
  timezone?: string;
  numberFormat?: string;
  distanceFormat?: string;
  defaultMapSite?: string;
  locale?: string;
}) {
  const user = await getCurrentUser();

  await db.user.update({
    where: { id: user.id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      nameOrder: data.nameOrder,
      dateFormat: data.dateFormat,
      timezone: data.timezone,
      numberFormat: data.numberFormat,
      distanceFormat: data.distanceFormat,
      defaultMapSite: data.defaultMapSite,
      locale: data.locale,
    },
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function updatePassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  const user = await getCurrentUser();

  // Verify current password
  if (user.password) {
    const isValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValid) {
      throw new Error("Current password is incorrect");
    }
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(data.newPassword, 12);

  await db.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return { success: true };
}

export async function deleteAccount() {
  const user = await getCurrentUser();

  // This will cascade delete all related data
  await db.user.delete({
    where: { id: user.id },
  });

  return { success: true };
}
