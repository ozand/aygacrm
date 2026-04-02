"use client";

import { useEffect, useState } from "react";
import { checkSeedingStatus, seedAllDefaultData } from "@/lib/actions/seed";

export function SeedInitializer() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;

    async function initSeed() {
      try {
        const status = await checkSeedingStatus();
        
        if (status.needsSeeding) {
          console.log("Seeding default data for:", status.missingData.join(", "));
          const result = await seedAllDefaultData();
          
          if (result.success) {
            console.log("Successfully seeded:", result.seeded.join(", "));
          } else {
            console.error("Seeding errors:", result.errors);
          }
        }
      } catch (error) {
        console.error("Error during seed initialization:", error);
      } finally {
        setInitialized(true);
      }
    }

    initSeed();
  }, [initialized]);

  // This component renders nothing - it's just for side effects
  return null;
}
