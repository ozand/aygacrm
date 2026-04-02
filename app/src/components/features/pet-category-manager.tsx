"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, PawPrint } from "lucide-react";
import {
  createPetCategory,
  updatePetCategory,
  deletePetCategory,
} from "@/lib/actions/pets";

interface PetCategory {
  id: string;
  name: string;
}

interface PetCategoryManagerProps {
  initialCategories: PetCategory[];
}

export function PetCategoryManager({ initialCategories }: PetCategoryManagerProps) {
  const [categories, setCategories] = useState<PetCategory[]>(initialCategories);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PetCategory | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);

    try {
      if (editingCategory) {
        const result = await updatePetCategory(editingCategory.id, name.trim());
        if (result.success) {
          setCategories(categories.map(c => 
            c.id === editingCategory.id ? { ...c, name: name.trim() } : c
          ));
        }
      } else {
        const result = await createPetCategory(name.trim());
        if (result.success && result.data) {
          setCategories([...categories, result.data as PetCategory]);
        }
      }
      setDialogOpen(false);
      setEditingCategory(null);
      setName("");
    } catch (error) {
      console.error("Error saving category:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this pet category?")) return;
    
    try {
      const result = await deletePetCategory(id);
      if (result.success) {
        setCategories(categories.filter(c => c.id !== id));
      }
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <PawPrint className="h-5 w-5" />
            Pet Categories
          </span>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingCategory(null);
              setName("");
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? "Edit Category" : "Add Category"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="categoryName">Category Name</Label>
                  <Input
                    id="categoryName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Dog, Cat, Bird"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={loading || !name.trim()}>
                    {loading ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm italic">
            No pet categories yet. Add one to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <span>{category.name}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditingCategory(category);
                      setName(category.name);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(category.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
