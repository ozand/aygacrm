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
import { Plus, Pencil, Trash2, Gift } from "lucide-react";
import {
  createGiftOccasion,
  updateGiftOccasion,
  deleteGiftOccasion,
} from "@/lib/actions/gifts";

interface GiftOccasion {
  id: string;
  label: string;
  position: number;
}

interface GiftOccasionManagerProps {
  initialOccasions: GiftOccasion[];
}

export function GiftOccasionManager({ initialOccasions }: GiftOccasionManagerProps) {
  const [occasions, setOccasions] = useState<GiftOccasion[]>(initialOccasions);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOccasion, setEditingOccasion] = useState<GiftOccasion | null>(null);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!label.trim()) return;
    setLoading(true);

    try {
      if (editingOccasion) {
        const result = await updateGiftOccasion(editingOccasion.id, label.trim());
        if (result.success) {
          setOccasions(occasions.map(o => 
            o.id === editingOccasion.id ? { ...o, label: label.trim() } : o
          ));
        }
      } else {
        const result = await createGiftOccasion(label.trim());
        if (result.success && result.data) {
          setOccasions([...occasions, result.data as GiftOccasion]);
        }
      }
      setDialogOpen(false);
      setEditingOccasion(null);
      setLabel("");
    } catch (error) {
      console.error("Error saving occasion:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this gift occasion?")) return;
    
    try {
      const result = await deleteGiftOccasion(id);
      if (result.success) {
        setOccasions(occasions.filter(o => o.id !== id));
      }
    } catch (error) {
      console.error("Error deleting occasion:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Gift Occasions
          </span>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingOccasion(null);
              setLabel("");
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Occasion
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingOccasion ? "Edit Occasion" : "Add Occasion"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="occasionLabel">Occasion Name</Label>
                  <Input
                    id="occasionLabel"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g., Birthday, Christmas"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={loading || !label.trim()}>
                    {loading ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {occasions.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm italic">
            No gift occasions yet. Add one to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {occasions.map((occasion) => (
              <div
                key={occasion.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <span>{occasion.label}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditingOccasion(occasion);
                      setLabel(occasion.label);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(occasion.id)}
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
