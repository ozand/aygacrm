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
import { Label } from "@/components/ui/label";
import { User, Pencil, Check, X } from "lucide-react";
import { updateContactGenderPronoun } from "@/lib/actions/gender-pronoun";

interface Gender {
  id: string;
  name: string;
  type: string;
}

interface Pronoun {
  id: string;
  name: string;
}

interface GenderPronounFormProps {
  contactId: string;
  genders: Gender[];
  pronouns: Pronoun[];
  currentGenderId: string | null;
  currentPronounId: string | null;
  currentGenderName: string | null;
  currentPronounName: string | null;
}

export function GenderPronounForm({
  contactId,
  genders,
  pronouns,
  currentGenderId,
  currentPronounId,
  currentGenderName,
  currentPronounName,
}: GenderPronounFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [genderId, setGenderId] = useState(currentGenderId || "");
  const [pronounId, setPronounId] = useState(currentPronounId || "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateContactGenderPronoun(contactId, {
        genderId: genderId || null,
        pronounId: pronounId || null,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating gender/pronoun:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setGenderId(currentGenderId || "");
    setPronounId(currentPronounId || "");
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div>
              {currentGenderName || currentPronounName ? (
                <>
                  {currentGenderName && (
                    <p className="text-sm font-medium">{currentGenderName}</p>
                  )}
                  {currentPronounName && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {currentPronounName}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  Not specified
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Edit gender and pronouns"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="gender">Gender</Label>
        <Select
          value={genderId}
          onValueChange={(v) => setGenderId(v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not specified</SelectItem>
            {genders.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pronoun">Pronouns</Label>
        <Select
          value={pronounId}
          onValueChange={(v) => setPronounId(v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select pronouns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not specified</SelectItem>
            {pronouns.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={loading}
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={loading}>
          <Check className="h-4 w-4 mr-1" />
          {loading ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
