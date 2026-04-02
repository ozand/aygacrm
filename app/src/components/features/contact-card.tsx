"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  MoreVertical,
  Star,
  Trash2,
  Edit,
} from "lucide-react";
import { deleteContact, toggleFavorite } from "@/lib/actions/contacts";
import { useTransition } from "react";

interface ContactCardProps {
  contact: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    nickname?: string | null;
    jobPosition?: string | null;
    contactInformation?: Array<{
      data: string;
      type: { type: string };
    }>;
  };
  isFavorite?: boolean;
}

export function ContactCard({ contact, isFavorite = false }: ContactCardProps) {
  const [isPending, startTransition] = useTransition();

  // Build display name
  const displayName =
    [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
    contact.nickname ||
    "Unnamed Contact";

  // Extract contact info
  const email = contact.contactInformation?.find(
    (ci) => ci.type.type === "email"
  )?.data;
  const phone = contact.contactInformation?.find(
    (ci) => ci.type.type === "phone"
  )?.data;

  // Get initials for avatar
  const initials = [contact.firstName?.[0], contact.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "?";

  function handleDelete() {
    if (confirm("Are you sure you want to delete this contact?")) {
      startTransition(async () => {
        await deleteContact(contact.id);
      });
    }
  }

  function handleToggleFavorite() {
    startTransition(async () => {
      await toggleFavorite(contact.id);
    });
  }

  return (
    <Card className={`transition-opacity ${isPending ? "opacity-50" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          {/* Avatar and Name */}
          <Link
            href={`/contacts/${contact.id}`}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-lg">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-gray-900 dark:text-white truncate">
                {displayName}
              </h3>
              {contact.jobPosition && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {contact.jobPosition}
                </p>
              )}
            </div>
          </Link>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleToggleFavorite}>
                <Star
                  className={`mr-2 h-4 w-4 ${isFavorite ? "fill-yellow-400 text-yellow-400" : ""}`}
                />
                {isFavorite ? "Remove from favorites" : "Add to favorites"}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/contacts/${contact.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Contact Info */}
        <div className="mt-4 space-y-2">
          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
            >
              <Mail className="h-4 w-4" />
              <span className="truncate">{email}</span>
            </a>
          )}
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
            >
              <Phone className="h-4 w-4" />
              <span>{phone}</span>
            </a>
          )}
          {!email && !phone && (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              No contact information
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
