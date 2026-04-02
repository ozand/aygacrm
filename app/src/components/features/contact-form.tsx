"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createContact, updateContact } from "@/lib/actions/contacts";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

interface ContactFormProps {
  contact?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    middleName?: string | null;
    nickname?: string | null;
    prefix?: string | null;
    suffix?: string | null;
    jobPosition?: string | null;
    contactInformation?: Array<{
      data: string;
      type: { type: string };
    }>;
  };
  mode: "create" | "edit";
}

export function ContactForm({ contact, mode }: ContactFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Extract email and phone from contact information
  const email = contact?.contactInformation?.find(
    (ci) => ci.type.type === "email"
  )?.data;
  const phone = contact?.contactInformation?.find(
    (ci) => ci.type.type === "phone"
  )?.data;

  async function handleSubmit(formData: FormData) {
    setError(null);

    startTransition(async () => {
      let result;

      if (mode === "create") {
        result = await createContact(formData);
      } else {
        result = await updateContact(contact!.id, formData);
      }

      if (result.success) {
        router.push("/contacts");
      } else {
        setError(result.error || "An error occurred");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/contacts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {mode === "create" ? "Add Contact" : "Edit Contact"}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {mode === "create"
              ? "Add a new person to your personal CRM."
              : "Update contact information."}
          </p>
        </div>
      </div>

      {/* Form */}
      <form action={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prefix">Prefix</Label>
                  <Input
                    id="prefix"
                    name="prefix"
                    placeholder="Mr., Mrs., Dr."
                    defaultValue={contact?.prefix || ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suffix">Suffix</Label>
                  <Input
                    id="suffix"
                    name="suffix"
                    placeholder="Jr., Sr., III"
                    defaultValue={contact?.suffix || ""}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder="John"
                  defaultValue={contact?.firstName || ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="middleName">Middle Name</Label>
                <Input
                  id="middleName"
                  name="middleName"
                  placeholder="William"
                  defaultValue={contact?.middleName || ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder="Doe"
                  defaultValue={contact?.lastName || ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname">Nickname</Label>
                <Input
                  id="nickname"
                  name="nickname"
                  placeholder="Johnny"
                  defaultValue={contact?.nickname || ""}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact & Work Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact & Work</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="john@example.com"
                  defaultValue={email || ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  defaultValue={phone || ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobPosition">Job Position</Label>
                <Input
                  id="jobPosition"
                  name="jobPosition"
                  placeholder="Software Engineer"
                  defaultValue={contact?.jobPosition || ""}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/contacts">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {mode === "create" ? "Create Contact" : "Save Changes"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
