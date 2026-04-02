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
import { Plus, Pencil, Trash2, Heart, ChevronDown, ChevronRight } from "lucide-react";
import {
  createLifeEventCategory,
  updateLifeEventCategory,
  deleteLifeEventCategory,
  createLifeEventType,
  updateLifeEventType,
  deleteLifeEventType,
} from "@/lib/actions/life-events";

interface LifeEventType {
  id: string;
  label: string;
}

interface LifeEventCategory {
  id: string;
  name: string;
  types: LifeEventType[];
}

interface LifeEventCategoryManagerProps {
  initialCategories: LifeEventCategory[];
}

export function LifeEventCategoryManager({ initialCategories }: LifeEventCategoryManagerProps) {
  const [categories, setCategories] = useState<LifeEventCategory[]>(initialCategories);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<LifeEventCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  
  // Type dialog state
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [typeCategoryId, setTypeCategoryId] = useState("");
  const [editingType, setEditingType] = useState<LifeEventType | null>(null);
  const [typeLabel, setTypeLabel] = useState("");
  
  const [loading, setLoading] = useState(false);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCategories(newExpanded);
  };

  // Category handlers
  const handleSaveCategory = async () => {
    if (!categoryName.trim()) return;
    setLoading(true);

    try {
      if (editingCategory) {
        const result = await updateLifeEventCategory(editingCategory.id, categoryName.trim());
        if (result.success) {
          setCategories(categories.map(c => 
            c.id === editingCategory.id ? { ...c, name: categoryName.trim() } : c
          ));
        }
      } else {
        const result = await createLifeEventCategory(categoryName.trim());
        if (result.success && result.data) {
          setCategories([...categories, { ...(result.data as LifeEventCategory), types: [] }]);
        }
      }
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryName("");
    } catch (error) {
      console.error("Error saving category:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category and all its event types?")) return;
    
    try {
      const result = await deleteLifeEventCategory(id);
      if (result.success) {
        setCategories(categories.filter(c => c.id !== id));
      }
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  // Type handlers
  const handleSaveType = async () => {
    if (!typeLabel.trim() || !typeCategoryId) return;
    setLoading(true);

    try {
      if (editingType) {
        const result = await updateLifeEventType(editingType.id, typeLabel.trim());
        if (result.success) {
          setCategories(categories.map(c => ({
            ...c,
            types: c.types.map(t => 
              t.id === editingType.id ? { ...t, label: typeLabel.trim() } : t
            )
          })));
        }
      } else {
        const result = await createLifeEventType(typeCategoryId, typeLabel.trim());
        if (result.success && result.data) {
          const newType = result.data as LifeEventType;
          setCategories(categories.map(c => 
            c.id === typeCategoryId 
              ? { ...c, types: [...c.types, newType] }
              : c
          ));
        }
      }
      setTypeDialogOpen(false);
      setEditingType(null);
      setTypeLabel("");
      setTypeCategoryId("");
    } catch (error) {
      console.error("Error saving type:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm("Delete this event type?")) return;
    
    try {
      const result = await deleteLifeEventType(id);
      if (result.success) {
        setCategories(categories.map(c => ({
          ...c,
          types: c.types.filter(t => t.id !== id)
        })));
      }
    } catch (error) {
      console.error("Error deleting type:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Life Event Categories
          </span>
          <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
            setCategoryDialogOpen(open);
            if (!open) {
              setEditingCategory(null);
              setCategoryName("");
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
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="e.g., Work & Education, Family"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveCategory} disabled={loading || !categoryName.trim()}>
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
            No life event categories yet. Add one to get started.
          </p>
        ) : (
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.id} className="border rounded-lg">
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => toggleExpanded(category.id)}
                >
                  <div className="flex items-center gap-2">
                    {expandedCategories.has(category.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="font-medium">{category.name}</span>
                    <span className="text-xs text-gray-500">
                      ({category.types.length} types)
                    </span>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setTypeCategoryId(category.id);
                        setTypeDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingCategory(category);
                        setCategoryName(category.name);
                        setCategoryDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteCategory(category.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {expandedCategories.has(category.id) && (
                  <div className="border-t p-3 bg-gray-50/50 dark:bg-gray-800/50">
                    {category.types.length === 0 ? (
                      <p className="text-gray-500 text-sm italic">No event types in this category</p>
                    ) : (
                      <div className="space-y-2">
                        {category.types.map((type) => (
                          <div
                            key={type.id}
                            className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <span className="text-sm">{type.label}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingType(type);
                                  setTypeLabel(type.label);
                                  setTypeCategoryId(category.id);
                                  setTypeDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteType(type.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Type Dialog */}
        <Dialog open={typeDialogOpen} onOpenChange={(open) => {
          setTypeDialogOpen(open);
          if (!open) {
            setEditingType(null);
            setTypeLabel("");
            setTypeCategoryId("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingType ? "Edit Event Type" : "Add Event Type"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="typeLabel">Event Type</Label>
                <Input
                  id="typeLabel"
                  value={typeLabel}
                  onChange={(e) => setTypeLabel(e.target.value)}
                  placeholder="e.g., Got married, Started new job"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setTypeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveType} disabled={loading || !typeLabel.trim()}>
                  {loading ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
