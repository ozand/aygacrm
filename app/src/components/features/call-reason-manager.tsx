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
import { Plus, Pencil, Trash2, Phone, ChevronDown, ChevronRight } from "lucide-react";
import {
  createCallReasonType,
  updateCallReasonType,
  deleteCallReasonType,
  createCallReason,
  updateCallReason,
  deleteCallReason,
} from "@/lib/actions/calls";

interface CallReason {
  id: string;
  label: string;
}

interface CallReasonType {
  id: string;
  label: string;
  reasons: CallReason[];
}

interface CallReasonManagerProps {
  initialReasonTypes: CallReasonType[];
}

export function CallReasonManager({ initialReasonTypes }: CallReasonManagerProps) {
  const [reasonTypes, setReasonTypes] = useState<CallReasonType[]>(initialReasonTypes);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  
  // Type dialog state
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<CallReasonType | null>(null);
  const [typeLabel, setTypeLabel] = useState("");
  
  // Reason dialog state
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [reasonTypeId, setReasonTypeId] = useState("");
  const [editingReason, setEditingReason] = useState<CallReason | null>(null);
  const [reasonLabel, setReasonLabel] = useState("");
  
  const [loading, setLoading] = useState(false);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedTypes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedTypes(newExpanded);
  };

  // Type handlers
  const handleSaveType = async () => {
    if (!typeLabel.trim()) return;
    setLoading(true);

    try {
      if (editingType) {
        const result = await updateCallReasonType(editingType.id, typeLabel.trim());
        if (result.success) {
          setReasonTypes(reasonTypes.map(t => 
            t.id === editingType.id ? { ...t, label: typeLabel.trim() } : t
          ));
        }
      } else {
        const result = await createCallReasonType(typeLabel.trim());
        if (result.success && result.data) {
          setReasonTypes([...reasonTypes, { ...(result.data as CallReasonType), reasons: [] }]);
        }
      }
      setTypeDialogOpen(false);
      setEditingType(null);
      setTypeLabel("");
    } catch (error) {
      console.error("Error saving type:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm("Delete this category and all its reasons?")) return;
    
    try {
      const result = await deleteCallReasonType(id);
      if (result.success) {
        setReasonTypes(reasonTypes.filter(t => t.id !== id));
      }
    } catch (error) {
      console.error("Error deleting type:", error);
    }
  };

  // Reason handlers
  const handleSaveReason = async () => {
    if (!reasonLabel.trim() || !reasonTypeId) return;
    setLoading(true);

    try {
      if (editingReason) {
        const result = await updateCallReason(editingReason.id, reasonLabel.trim());
        if (result.success) {
          setReasonTypes(reasonTypes.map(t => ({
            ...t,
            reasons: t.reasons.map(r => 
              r.id === editingReason.id ? { ...r, label: reasonLabel.trim() } : r
            )
          })));
        }
      } else {
        const result = await createCallReason(reasonTypeId, reasonLabel.trim());
        if (result.success && result.data) {
          const newReason = result.data as CallReason;
          setReasonTypes(reasonTypes.map(t => 
            t.id === reasonTypeId 
              ? { ...t, reasons: [...t.reasons, newReason] }
              : t
          ));
        }
      }
      setReasonDialogOpen(false);
      setEditingReason(null);
      setReasonLabel("");
      setReasonTypeId("");
    } catch (error) {
      console.error("Error saving reason:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReason = async (id: string) => {
    if (!confirm("Delete this reason?")) return;
    
    try {
      const result = await deleteCallReason(id);
      if (result.success) {
        setReasonTypes(reasonTypes.map(t => ({
          ...t,
          reasons: t.reasons.filter(r => r.id !== id)
        })));
      }
    } catch (error) {
      console.error("Error deleting reason:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Reasons
          </span>
          <Dialog open={typeDialogOpen} onOpenChange={(open) => {
            setTypeDialogOpen(open);
            if (!open) {
              setEditingType(null);
              setTypeLabel("");
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
                  {editingType ? "Edit Category" : "Add Category"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="typeLabel">Category Name</Label>
                  <Input
                    id="typeLabel"
                    value={typeLabel}
                    onChange={(e) => setTypeLabel(e.target.value)}
                    placeholder="e.g., Personal, Business"
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
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reasonTypes.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm italic">
            No call reason categories yet. Add one to get started.
          </p>
        ) : (
          <div className="space-y-4">
            {reasonTypes.map((type) => (
              <div key={type.id} className="border rounded-lg">
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => toggleExpanded(type.id)}
                >
                  <div className="flex items-center gap-2">
                    {expandedTypes.has(type.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="font-medium">{type.label}</span>
                    <span className="text-xs text-gray-500">
                      ({type.reasons.length} reasons)
                    </span>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setReasonTypeId(type.id);
                        setReasonDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingType(type);
                        setTypeLabel(type.label);
                        setTypeDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteType(type.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {expandedTypes.has(type.id) && (
                  <div className="border-t p-3 bg-gray-50/50 dark:bg-gray-800/50">
                    {type.reasons.length === 0 ? (
                      <p className="text-gray-500 text-sm italic">No reasons in this category</p>
                    ) : (
                      <div className="space-y-2">
                        {type.reasons.map((reason) => (
                          <div
                            key={reason.id}
                            className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <span className="text-sm">{reason.label}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingReason(reason);
                                  setReasonLabel(reason.label);
                                  setReasonTypeId(type.id);
                                  setReasonDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteReason(reason.id)}
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

        {/* Reason Dialog */}
        <Dialog open={reasonDialogOpen} onOpenChange={(open) => {
          setReasonDialogOpen(open);
          if (!open) {
            setEditingReason(null);
            setReasonLabel("");
            setReasonTypeId("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingReason ? "Edit Reason" : "Add Reason"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reasonLabel">Reason</Label>
                <Input
                  id="reasonLabel"
                  value={reasonLabel}
                  onChange={(e) => setReasonLabel(e.target.value)}
                  placeholder="e.g., Catch up, Follow up"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReasonDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveReason} disabled={loading || !reasonLabel.trim()}>
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
