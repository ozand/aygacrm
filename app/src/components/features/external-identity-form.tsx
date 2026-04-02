"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link2, X, Plus, ShieldCheck, Shield } from "lucide-react";
import {
  addExternalIdentity,
  deleteExternalIdentity,
} from "@/lib/actions/external-identities";

interface ExternalIdentity {
  id: string;
  source: string;
  externalId: string;
  label: string | null;
  verified: boolean;
  confidence: number;
  createdAt: Date;
}

interface ExternalIdentityFormProps {
  contactId: string;
  existingIdentities: ExternalIdentity[];
}

const SOURCE_CONFIG: Record<string, { label: string; color: string; placeholder: string }> = {
  email: {
    label: "Email",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    placeholder: "Email address",
  },
  phone: {
    label: "Phone",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    placeholder: "Phone number",
  },
  linkedin: {
    label: "LinkedIn",
    color: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
    placeholder: "LinkedIn profile URL",
  },
  telegram: {
    label: "Telegram",
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    placeholder: "Telegram username",
  },
  whatsapp: {
    label: "WhatsApp",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    placeholder: "WhatsApp number",
  },
  vk: {
    label: "VK",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    placeholder: "VK profile URL",
  },
  facebook: {
    label: "Facebook",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    placeholder: "Facebook profile URL",
  },
  other: {
    label: "Other",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    placeholder: "Identifier",
  },
};

const SOURCE_OPTIONS = [
  "email",
  "phone",
  "linkedin",
  "telegram",
  "whatsapp",
  "vk",
  "facebook",
  "other",
] as const;

type SourceKey = (typeof SOURCE_OPTIONS)[number];

function getActionErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Something went wrong";
}

export function ExternalIdentityForm({
  contactId,
  existingIdentities,
}: ExternalIdentityFormProps) {
  const [isPending, startTransition] = useTransition();
  const [identities, setIdentities] = useState<ExternalIdentity[]>(existingIdentities);
  const [source, setSource] = useState<SourceKey>("email");
  const [externalId, setExternalId] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIdentities(existingIdentities);
  }, [existingIdentities]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedExternalId = externalId.trim();
    const trimmedLabel = label.trim();

    if (!trimmedExternalId) {
      setError("External ID is required");
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticIdentity: ExternalIdentity = {
      id: tempId,
      source,
      externalId: trimmedExternalId,
      label: trimmedLabel || null,
      verified: false,
      confidence: 1,
      createdAt: new Date(),
    };

    setIdentities((prev) => [optimisticIdentity, ...prev]);

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("source", source);
    formData.set("externalId", trimmedExternalId);
    if (trimmedLabel) {
      formData.set("label", trimmedLabel);
    }

    startTransition(async () => {
      try {
        const result = await addExternalIdentity(formData);

        if (result && typeof result === "object" && "success" in result && !result.success) {
          const message =
            typeof result.error === "string" ? result.error : "Failed to add external identity";
          throw new Error(message);
        }

        const saved =
          result && typeof result === "object" && "data" in result
            ? (result.data as ExternalIdentity)
            : (result as unknown as ExternalIdentity);

        if (saved && typeof saved.id === "string") {
          setIdentities((prev) =>
            prev.map((identity) => (identity.id === tempId ? saved : identity))
          );
        }

        setExternalId("");
        setLabel("");
        setSource("email");
        toast.success("External identity added");
      } catch (err) {
        setIdentities((prev) => prev.filter((identity) => identity.id !== tempId));
        const message = getActionErrorMessage(err);
        const lowerMessage = message.toLowerCase();
        const friendlyMessage =
          lowerMessage.includes("already exists") || lowerMessage.includes("duplicate")
            ? "This identity is already linked."
            : message;

        setError(friendlyMessage);
        toast.error(friendlyMessage);
      }
    });
  };

  const handleDelete = (identity: ExternalIdentity) => {
    setError(null);

    setIdentities((prev) => prev.filter((item) => item.id !== identity.id));

    startTransition(async () => {
      try {
        const result = await deleteExternalIdentity(identity.id);

        if (result && typeof result === "object" && "success" in result && !result.success) {
          const message =
            typeof result.error === "string"
              ? result.error
              : "Failed to delete external identity";
          throw new Error(message);
        }

        toast.success("External identity removed");
      } catch (err) {
        setIdentities((prev) => [identity, ...prev]);
        const message = getActionErrorMessage(err);
        setError(message);
        toast.error(message);
      }
    });
  };

  const currentSourceConfig = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.other;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {identities.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No external identities linked yet.
          </p>
        ) : (
          <div className="space-y-2">
            {identities.map((identity) => {
              const config = SOURCE_CONFIG[identity.source] ?? SOURCE_CONFIG.other;

              return (
                <div
                  key={identity.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={config.color}>
                        <Link2 className="mr-1 h-3 w-3" />
                        {config.label}
                      </Badge>
                      {identity.verified && (
                        <Badge variant="outline" className="border-green-600 text-green-600 dark:border-green-500 dark:text-green-400">
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          Verified
                        </Badge>
                      )}
                      {!identity.verified && (
                        <Badge variant="outline" className="text-gray-500 dark:text-gray-400">
                          <Shield className="mr-1 h-3 w-3" />
                          Unverified
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {identity.externalId}
                    </p>
                    {identity.label && (
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {identity.label}
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(identity)}
                    disabled={isPending}
                    className="h-7 w-7 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                    aria-label="Delete external identity"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleAdd} className="space-y-3 rounded-lg border p-3 dark:border-gray-800">
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={source} onValueChange={(value) => setSource(value as SourceKey)}>
              <SelectTrigger disabled={isPending}>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {SOURCE_CONFIG[option].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder={currentSourceConfig.placeholder}
              disabled={isPending}
              className="md:col-span-2"
            />
          </div>

          <div className="flex gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional)"
              disabled={isPending}
              className="flex-1"
            />
            <Button type="submit" disabled={isPending || !externalId.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
