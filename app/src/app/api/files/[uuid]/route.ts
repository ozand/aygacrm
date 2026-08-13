import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { presignGet } from "@/lib/storage/s3";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { uuid } = await params;

  // Vault-scope: the file's vault must belong to the signed-in user.
  const file = await db.file.findFirst({
    where: { uuid, vault: { users: { some: { userId: session.user.id } } } },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (file.storageKey) {
    const url = await presignGet(file.storageKey, 300);
    return NextResponse.redirect(url, 307);
  }
  // Legacy local-disk file: redirect to its stored public path.
  if (file.originalUrl.startsWith("/api/files/")) {
    return NextResponse.json({ error: "File object missing" }, { status: 404 });
  }
  return NextResponse.redirect(new URL(file.originalUrl, _req.url), 307);
}
