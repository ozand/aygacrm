export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { ContactForm } from "@/components/features/contact-form";
import { getContact } from "@/lib/actions/contacts";
import { AvatarUpload } from "@/components/features/avatar-upload";
import { getContactAvatar, getContactPhotos } from "@/lib/actions/avatar";

interface EditContactPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditContactPage({
  params,
}: EditContactPageProps) {
  const { id } = await params;
  const contact = await getContact(id);

  if (!contact) {
    notFound();
  }

  const avatar = await getContactAvatar(id);
  const photos = await getContactPhotos(id);
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
      <ContactForm contact={contact} mode="edit" />

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
