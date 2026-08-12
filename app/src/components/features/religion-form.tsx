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
import { Heart, Pencil, Check, X } from "lucide-react";
import { updateContactReligion } from "@/lib/actions/religion";

interface Religion {
  id: string;
  name: string;
}

interface ReligionFormProps {
  contactId: string;
  religions: Religion[];
  currentReligionId: string | null;
  currentReligionName: string | null;
}

export function ReligionForm({
  contactId,
  religions,
  currentReligionId,
  currentReligionName,
}: ReligionFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [religionId, setReligionId] = useState(currentReligionId || "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateContactReligion(
        contactId,
        religionId && religionId !== "none" ? religionId : null
      );
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating religion:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setReligionId(currentReligionId || "");
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
            <Heart className="h-5 w-5" />
          </div>
          <div>
            {currentReligionName ? (
              <p className="text-sm font-medium">{currentReligionName}</p>
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
          aria-label="Edit religion"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Select value={religionId} onValueChange={setReligionId}>
        <SelectTrigger>
          <SelectValue placeholder="Select religion/belief" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Not specified</SelectItem>
          {religions.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
