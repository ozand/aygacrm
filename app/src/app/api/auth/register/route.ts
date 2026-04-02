export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create account first
    const account = await db.account.create({
      data: {
        storageLimitMb: 50,
      },
    });

    // Create default vault for the account
    const vault = await db.vault.create({
      data: {
        name: "Personal",
        description: "Your personal contacts vault",
        type: "PERSONAL",
        accountId: account.id,
      },
    });

    // Create user
    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        accountId: account.id,
        isAccountAdministrator: true,
      },
    });

    // Create "self" contact for the user in the vault
    const selfContact = await db.contact.create({
      data: {
        firstName: firstName || null,
        lastName: lastName || null,
        vaultId: vault.id,
        canBeDeleted: false, // User's own contact cannot be deleted
        listed: true,
      },
    });

    // Link user to vault with OWNER permission
    await db.userVault.create({
      data: {
        userId: user.id,
        vaultId: vault.id,
        contactId: selfContact.id,
        permission: "OWNER",
      },
    });

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
