import "dotenv/config";
import { db } from "../src/lib/db";

async function fixUserVault() {
  console.log("Checking users without vaults...\n");

  // Find all users
  const users = await db.user.findMany({
    include: {
      vaultAccess: {
        include: {
          vault: true,
        },
      },
    },
  });

  console.log(`Found ${users.length} users\n`);

  for (const user of users) {
    console.log(`User: ${user.email}`);
    console.log(`  Account ID: ${user.accountId}`);
    console.log(`  Vaults: ${user.vaultAccess.length}`);

    if (user.vaultAccess.length === 0) {
      console.log("  -> No vault! Creating one...");

      // Check if account has a vault already
      let vault = await db.vault.findFirst({
        where: { accountId: user.accountId },
      });

      if (!vault) {
        console.log("  -> Creating new vault for account...");
        vault = await db.vault.create({
          data: {
            name: "Personal",
            description: "Your personal contacts vault",
            type: "PERSONAL",
            accountId: user.accountId,
          },
        });
      } else {
        console.log("  -> Found existing vault:", vault.name);
      }

      // Create "self" contact for the user in the vault
      const selfContact = await db.contact.create({
        data: {
          firstName: user.firstName || null,
          lastName: user.lastName || null,
          vaultId: vault.id,
          canBeDeleted: false,
          listed: true,
        },
      });

      // Link user to vault
      await db.userVault.create({
        data: {
          userId: user.id,
          vaultId: vault.id,
          contactId: selfContact.id,
          permission: "OWNER",
        },
      });

      console.log("  -> Vault created and linked!");
    } else {
      console.log("  -> Already has vault(s):", user.vaultAccess.map(v => v.vault.name).join(", "));
    }
    console.log("");
  }

  console.log("Done!");
  process.exit(0);
}

fixUserVault().catch((e) => {
  console.error(e);
  process.exit(1);
});
