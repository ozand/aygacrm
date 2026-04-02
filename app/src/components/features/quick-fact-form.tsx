"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  Loader2,
  Edit2,
  X,
  Check,
  Sparkles,
} from "lucide-react";
import {
  createQuickFact,
  updateQuickFact,
  deleteQuickFact,
} from "@/lib/actions/quick-facts";

interface QuickFact {
  id: string;
  label: string;
  value: string;
  position: number;
}

interface QuickFactFormProps {
  contactId: string;
  existingFacts: QuickFact[];
}

// Common quick fact suggestions
const SUGGESTIONS = [
  "Favorite food",
  "Favorite drink",
  "Favorite movie",
  "Favorite book",
  "Favorite music",
  "Hobbies",
  "Allergies",
  "Pet peeves",
  "Dream vacation",
  "Favorite color",
  "Favorite sport",
  "Coffee or tea",
];

export function QuickFactForm({
  contactId,
  existingFacts,
}: QuickFactFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!label.trim() || !value.trim()) {
      setError("Both label and value are required");
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("label", label);
    formData.set("value", value);

    startTransition(async () => {
      const result = await createQuickFact(formData);
      if (result.success) {
        setShowForm(false);
        setLabel("");
        setValue("");
      } else {
        setError(result.error || "Failed to create quick fact");
      }
    });
  };

  const handleUpdate = async (id: string) => {
    setError(null);

    if (!editLabel.trim() || !editValue.trim()) {
      setError("Both label and value are required");
      return;
    }

    const formData = new FormData();
    formData.set("id", id);
    formData.set("label", editLabel);
    formData.set("value", editValue);

    startTransition(async () => {
      const result = await updateQuickFact(formData);
      if (result.success) {
        setEditingId(null);
      } else {
        setError(result.error || "Failed to update quick fact");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteQuickFact(id);
    });
  };

  const startEditing = (fact: QuickFact) => {
    setEditingId(fact.id);
    setEditLabel(fact.label);
    setEditValue(fact.value);
    setError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditLabel("");
    setEditValue("");
    setError(null);
  };

  const selectSuggestion = (suggestion: string) => {
    setLabel(suggestion);
  };

  // Filter out already used labels
  const availableSuggestions = SUGGESTIONS.filter(
    (s) => !existingFacts.some((f) => f.label.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className={`space-y-4 ${isPending ? "opacity-50" : ""}`}>
      {/* Existing quick facts */}
      {existingFacts.length > 0 ? (
        <div className="space-y-2">
          {existingFacts.map((fact) => (
            <div
              key={fact.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              {editingId === fact.id ? (
                <>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Label"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Value"
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleUpdate(fact.id)}
                    disabled={isPending}
                    className="h-8 w-8"
                  >
                    <Check className="h-4 w-4 text-green-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={cancelEditing}
                    disabled={isPending}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {fact.label}:
                    </span>{" "}
                    <span className="text-sm text-gray-900 dark:text-white">
                      {fact.value}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEditing(fact)}
                    disabled={isPending}
                    className="h-8 w-8"
                  >
                    <Edit2 className="h-4 w-4 text-gray-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(fact.id)}
                    disabled={isPending}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No quick facts added yet. Add things like favorite food, hobbies, etc.
          </p>
        )
      )}

      {/* Add quick fact form */}
      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 p-4 border rounded-lg"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="label">Label *</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Favorite food"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Value *</Label>
              <Input
                id="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g., Pizza"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Suggestions */}
          {availableSuggestions.length > 0 && !label && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-xs text-gray-500">
                <Sparkles className="h-3 w-3" />
                Suggestions
              </Label>
              <div className="flex flex-wrap gap-1">
                {availableSuggestions.slice(0, 6).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => selectSuggestion(suggestion)}
                    className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Fact
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setLabel("");
                setValue("");
                setError(null);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          disabled={isPending}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Quick Fact
        </Button>
      )}
    </div>
  );
}
