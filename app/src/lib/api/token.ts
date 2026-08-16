// Next-free API-token primitives.
//
// These are deliberately isolated from ./auth (which imports `next/server` for
// NextRequest/NextResponse helpers). Standalone entry points that only need to
// validate a token — the MCP stdio bin (src/mcp/aygacrm-mcp.ts) and the MCP
// server core (src/lib/mcp/server.ts) — import from here so their bundles never
// drag `next/server`, which is not resolvable under plain Node. ./auth
// re-exports everything below, so the ~40 API routes keep importing from
// "@/lib/api/auth" unchanged.

import { db } from "@/lib/db";
import crypto from "crypto";

// Token context type
export interface ApiAuthContext {
  userId: string;
  accountId: string;
  tokenId: string;
  abilities: string[];
}

// Hash token for storage (SHA256)
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Generate a new API token
export function generateToken(): { token: string; prefix: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const prefix = token.substring(0, 8);
  return { token, prefix };
}

// Validate a raw API token value (hash + lookup + expiry + last-used bump)
export async function validateApiTokenValue(
  token: string
): Promise<ApiAuthContext | null> {
  const hashedToken = hashToken(token);

  try {
    const apiToken = await db.apiToken.findUnique({
      where: { token: hashedToken },
      include: {
        user: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!apiToken) {
      return null;
    }

    // Check if token is expired
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp
    await db.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      userId: apiToken.userId,
      accountId: apiToken.user.accountId,
      tokenId: apiToken.id,
      abilities: apiToken.abilities,
    };
  } catch (error) {
    console.error("Error validating API token:", error);
    return null;
  }
}

// Check if token has specific ability
export function hasAbility(context: ApiAuthContext, ability: string): boolean {
  // "*" means all abilities
  if (context.abilities.includes("*")) {
    return true;
  }
  return context.abilities.includes(ability);
}
