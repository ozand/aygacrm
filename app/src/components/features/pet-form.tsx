"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Loader2,
  Edit2,
  X,
  Check,
  PawPrint,
  Dog,
  Cat,
  Bird,
  Fish,
} from "lucide-react";
import { createPet, updatePet, deletePet } from "@/lib/actions/pets";

interface PetCategory {
  id: string;
  name: string;
}

interface Pet {
  id: string;
  name: string | null;
  petCategory: PetCategory | null;
}

interface PetFormProps {
  contactId: string;
  categories: PetCategory[];
  existingPets: Pet[];
}

// Pet category icons
const getCategoryIcon = (categoryName: string | null | undefined) => {
  const name = categoryName?.toLowerCase() || "";
  if (name.includes("dog")) return <Dog className="h-4 w-4" />;
  if (name.includes("cat")) return <Cat className="h-4 w-4" />;
  if (name.includes("bird")) return <Bird className="h-4 w-4" />;
  if (name.includes("fish")) return <Fish className="h-4 w-4" />;
  return <PawPrint className="h-4 w-4" />;
};

export function PetForm({
  contactId,
  categories,
  existingPets,
}: PetFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [editName, setEditName] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!categoryId && !name.trim()) {
      setError("Please provide a name or select a pet type");
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("name", name);
    if (categoryId) formData.set("petCategoryId", categoryId);

    startTransition(async () => {
      const result = await createPet(formData);
      if (result.success) {
        setShowForm(false);
        setName("");
        setCategoryId("");
      } else {
        setError(result.error || "Failed to add pet");
      }
    });
  };

  const handleUpdate = async (id: string) => {
    setError(null);

    const formData = new FormData();
    formData.set("id", id);
    formData.set("name", editName);
    if (editCategoryId) formData.set("petCategoryId", editCategoryId);

    startTransition(async () => {
      const result = await updatePet(formData);
      if (result.success) {
        setEditingId(null);
      } else {
        setError(result.error || "Failed to update pet");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deletePet(id);
    });
  };

  const startEditing = (pet: Pet) => {
    setEditingId(pet.id);
    setEditName(pet.name || "");
    setEditCategoryId(pet.petCategory?.id || "");
    setError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditCategoryId("");
    setError(null);
  };

  const getPetDisplayName = (pet: Pet) => {
    if (pet.name && pet.petCategory) {
      return `${pet.name} (${pet.petCategory.name})`;
    }
    return pet.name || pet.petCategory?.name || "Unknown pet";
  };

  return (
    <div className={`space-y-4 ${isPending ? "opacity-50" : ""}`}>
      {/* Existing pets */}
      {existingPets.length > 0 ? (
        <div className="space-y-2">
          {existingPets.map((pet) => (
            <div
              key={pet.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              {editingId === pet.id ? (
                <>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Pet name"
                      className="h-8 text-sm"
                    />
                    <Select value={editCategoryId} onValueChange={setEditCategoryId}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleUpdate(pet.id)}
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
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {getCategoryIcon(pet.petCategory?.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-900 dark:text-white">
                      {getPetDisplayName(pet)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEditing(pet)}
                    disabled={isPending}
                    className="h-8 w-8"
                  >
                    <Edit2 className="h-4 w-4 text-gray-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(pet.id)}
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
            No pets added yet.
          </p>
        )
      )}

      {/* Add pet form */}
      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 p-4 border rounded-lg"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="petName">Name</Label>
              <Input
                id="petName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Buddy"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="petCategory">Type</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {categories.length === 0 ? (
                    <SelectItem value="" disabled>
                      No pet types available
                    </SelectItem>
                  ) : (
                    categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Pet
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setName("");
                setCategoryId("");
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
          Add Pet
        </Button>
      )}
    </div>
  );
}
