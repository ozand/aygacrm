export const dynamic = 'force-dynamic';

import { ContactForm } from "@/components/features/contact-form";
import { getGenders, getPronouns } from "@/lib/actions/gender-pronoun";
import { getCompanies } from "@/lib/actions/companies";
import { getReligions } from "@/lib/actions/religion";

export default async function NewContactPage() {
  const [genders, pronouns, companies, religions] = await Promise.all([
    getGenders(),
    getPronouns(),
    getCompanies(),
    getReligions(),
  ]);

  return (
    <ContactForm
      mode="create"
      genders={genders}
      pronouns={pronouns}
      companies={companies}
      religions={religions}
    />
  );
}
