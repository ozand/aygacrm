"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ==================== CURRENCIES ====================
// Global reference table for currency codes

export async function getCurrencies() {
  return db.currency.findMany({
    orderBy: { code: "asc" },
  });
}

export async function getCurrency(id: string) {
  return db.currency.findUnique({
    where: { id },
  });
}

export async function getCurrencyByCode(code: string) {
  return db.currency.findUnique({
    where: { code },
  });
}

export async function createCurrency(data: { code: string; name: string }) {
  const currency = await db.currency.create({
    data: {
      code: data.code.toUpperCase(),
      name: data.name,
    },
  });

  revalidatePath("/settings");
  return currency;
}

export async function updateCurrency(
  id: string,
  data: { code?: string; name?: string }
) {
  const currency = await db.currency.update({
    where: { id },
    data: {
      code: data.code?.toUpperCase(),
      name: data.name,
    },
  });

  revalidatePath("/settings");
  return currency;
}

export async function deleteCurrency(id: string) {
  await db.currency.delete({ where: { id } });
  revalidatePath("/settings");
  return { success: true };
}

// Seed common currencies
export async function seedCurrencies() {
  const existingCount = await db.currency.count();

  if (existingCount > 0) {
    return { success: true, data: { message: "Currencies already exist" } };
  }

  const defaultCurrencies = [
    { code: "USD", name: "US Dollar" },
    { code: "EUR", name: "Euro" },
    { code: "GBP", name: "British Pound" },
    { code: "JPY", name: "Japanese Yen" },
    { code: "CHF", name: "Swiss Franc" },
    { code: "CAD", name: "Canadian Dollar" },
    { code: "AUD", name: "Australian Dollar" },
    { code: "NZD", name: "New Zealand Dollar" },
    { code: "CNY", name: "Chinese Yuan" },
    { code: "INR", name: "Indian Rupee" },
    { code: "BRL", name: "Brazilian Real" },
    { code: "MXN", name: "Mexican Peso" },
    { code: "RUB", name: "Russian Ruble" },
    { code: "KRW", name: "South Korean Won" },
    { code: "SGD", name: "Singapore Dollar" },
    { code: "HKD", name: "Hong Kong Dollar" },
    { code: "SEK", name: "Swedish Krona" },
    { code: "NOK", name: "Norwegian Krone" },
    { code: "DKK", name: "Danish Krone" },
    { code: "PLN", name: "Polish Zloty" },
    { code: "TRY", name: "Turkish Lira" },
    { code: "ZAR", name: "South African Rand" },
    { code: "THB", name: "Thai Baht" },
    { code: "IDR", name: "Indonesian Rupiah" },
    { code: "PHP", name: "Philippine Peso" },
    { code: "CZK", name: "Czech Koruna" },
    { code: "ILS", name: "Israeli Shekel" },
    { code: "AED", name: "UAE Dirham" },
    { code: "SAR", name: "Saudi Riyal" },
    { code: "MYR", name: "Malaysian Ringgit" },
  ];

  await db.currency.createMany({
    data: defaultCurrencies,
  });

  revalidatePath("/settings");
  return { success: true, data: { message: "Default currencies seeded" } };
}
