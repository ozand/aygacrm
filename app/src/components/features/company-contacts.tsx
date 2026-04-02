"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Plus, X } from "lucide-react";
import { addContactToCompany, removeContactFromCompany } from "@/lib/actions/companies";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Contact {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

interface CompanyContactsProps {
  companyId: string;
  contacts: Contact[];
  unassignedContacts: Contact[];
}

export function CompanyContacts({
  companyId,
  contacts,
  unassignedContacts,
}: CompanyContactsProps) {
  const router = useRouter();
  const [selectedContact, setSelectedContact] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleAdd() {
    if (!selectedContact) return;
    setAdding(true);
    try {
      await addContactToCompany(companyId, selectedContact);
      setSelectedContact("");
      router.refresh();
    } catch (error) {
      console.error("Error adding contact:", error);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(contactId: string) {
    setRemovingId(contactId);
    try {
      await removeContactFromCompany(contactId);
      router.refresh();
    } catch (error) {
      console.error("Error removing contact:", error);
    } finally {
      setRemovingId(null);
    }
  }

  const formatName = (contact: Contact) => {
    return `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "Unnamed";
  };

  return (
    <div className="space-y-4">
      {/* Add contact */}
      {unassignedContacts.length > 0 && (
        <div className="flex gap-2">
          <Select value={selectedContact} onValueChange={setSelectedContact}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a contact to add..." />
            </SelectTrigger>
            <SelectContent>
              {unassignedContacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {formatName(contact)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAdd} disabled={!selectedContact || adding}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Contact list */}
      {contacts.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">
          No contacts assigned to this company yet
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <Link
                href={`/contacts/${contact.id}`}
                className="flex items-center gap-3 flex-1 hover:text-primary"
              >
                <User className="h-5 w-5 text-muted-foreground" />
                <div className="font-medium">{formatName(contact)}</div>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(contact.id)}
                disabled={removingId === contact.id}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
