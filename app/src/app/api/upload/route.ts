export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's vault
    const userVault = await db.userVault.findFirst({
      where: { userId: session.user.id },
      include: { vault: true },
    });

    if (!userVault) {
      return NextResponse.json({ error: "No vault found" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const contactId = formData.get("contactId") as string;
    const fileType = (formData.get("type") as string) || "photo";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // Verify contact belongs to user's vault
    if (contactId) {
      const contact = await db.contact.findFirst({
        where: { id: contactId, vaultId: userVault.vault.id },
      });

      if (!contact) {
        return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 }
        );
      }
    }

    // Generate unique filename
    const fileUuid = crypto.randomUUID();
    const ext = path.extname(file.name) || ".jpg";
    const filename = `${fileUuid}${ext}`;

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await mkdir(uploadsDir, { recursive: true });

    // Save file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(uploadsDir, filename);
    await writeFile(filePath, buffer);

    // Generate URL
    const fileUrl = `/uploads/avatars/${filename}`;

    // If uploading new avatar, demote old one
    if (fileType === "avatar" && contactId) {
      await db.file.updateMany({
        where: { contactId, type: "avatar" },
        data: { type: "photo" },
      });
    }

    // Create database record
    const fileRecord = await db.file.create({
      data: {
        uuid: fileUuid,
        name: file.name,
        originalUrl: fileUrl,
        mimeType: file.type,
        size: file.size,
        type: fileType,
        vaultId: userVault.vault.id,
        contactId: contactId || null,
      },
    });

    return NextResponse.json({
      success: true,
      file: {
        id: fileRecord.id,
        url: fileUrl,
        name: fileRecord.name,
        type: fileRecord.type,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
