export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { ContactForm } from "@/components/features/contact-form";
import { getContact } from "@/lib/actions/contacts";
import { AvatarUpload } from "@/components/features/avatar-upload";
import { getContactAvatar, getContactPhotos } from "@/lib/actions/avatar";
import { getGenders, getPronouns } from "@/lib/actions/gender-pronoun";
import { getCompanies } from "@/lib/actions/companies";
import { getReligions } from "@/lib/actions/religion";

interface EditContactPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditContactPage({
  params,
}: EditContactPageProps) {
  const { id } = await params;

  const [contact, avatar, photos, genders, pronouns, companies, religions] = await Promise.all([
    getContact(id),
    getContactAvatar(id),
    getContactPhotos(id),
    getGenders(),
    getPronouns(),
    getCompanies(),
    getReligions(),
  ]);

  if (!contact) {
    notFound();
  }

  const displayName =
    [
      contact.prefix,
      contact.firstName,
      contact.middleName,
      contact.lastName,
      contact.suffix,
    ]
      .filter(Boolean)
      .join(" ") ||
    contact.nickname ||
    "Unnamed Contact";
  const initials =
    [contact.firstName?.[0], contact.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="space-y-6">
      <ContactForm
        contact={contact}
        mode="edit"
        genders={genders}
        pronouns={pronouns}
        companies={companies}
        religions={religions}
      />

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Avatar</h2>
        <AvatarUpload
          contactId={id}
          currentAvatar={avatar}
          photos={photos}
          initials={initials}
          displayName={displayName}
        />
      </div>
    </div>
  );
}
