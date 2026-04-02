"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Activity, Loader2 } from "lucide-react";
import {
  getJournalMetrics,
  createJournalMetric,
  updateJournalMetric,
  deleteJournalMetric,
  seedJournalMetrics,
} from "@/lib/actions/journal";

interface JournalMetric {
  id: string;
  label: string;
  unit: string | null;
  _count: { postMetrics: number };
}

export function JournalMetricsManager() {
  const [metrics, setMetrics] = useState<JournalMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<JournalMetric | null>(null);
  const [formData, setFormData] = useState({ label: "", unit: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    try {
      const data = await getJournalMetrics();
      setMetrics(data);
    } catch (error) {
      console.error("Error loading metrics:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSeedDefaults() {
    setSaving(true);
    try {
      await seedJournalMetrics();
      await loadMetrics();
    } catch (error) {
      console.error("Error seeding defaults:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    if (!formData.label.trim()) return;

    setSaving(true);
    try {
      const metric = await createJournalMetric({
        label: formData.label.trim(),
        unit: formData.unit.trim() || undefined,
      });
      setMetrics([...metrics, { ...metric, _count: { postMetrics: 0 } }]);
      setFormData({ label: "", unit: "" });
      setIsAddOpen(false);
    } catch (error) {
      console.error("Error creating metric:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editingMetric || !formData.label.trim()) return;

    setSaving(true);
    try {
      await updateJournalMetric(editingMetric.id, {
        label: formData.label.trim(),
        unit: formData.unit.trim() || undefined,
      });
      setMetrics(
        metrics.map((m) =>
          m.id === editingMetric.id
            ? { ...m, label: formData.label.trim(), unit: formData.unit.trim() || null }
            : m
        )
      );
      setEditingMetric(null);
      setFormData({ label: "", unit: "" });
    } catch (error) {
      console.error("Error updating metric:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this metric? All recorded values will be lost.")) {
      return;
    }

    try {
      await deleteJournalMetric(id);
      setMetrics(metrics.filter((m) => m.id !== id));
    } catch (error) {
      console.error("Error deleting metric:", error);
    }
  }

  function openEdit(metric: JournalMetric) {
    setEditingMetric(metric);
    setFormData({ label: metric.label, unit: metric.unit || "" });
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Journal Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Journal Metrics
            </CardTitle>
            <CardDescription>
              Define metrics to track in your journal entries (e.g., weight, mood, sleep)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {metrics.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedDefaults}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Defaults
              </Button>
            )}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Metric
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Journal Metric</DialogTitle>
                  <DialogDescription>
                    Create a new metric to track in your journal entries.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="label">Label</Label>
                    <Input
                      id="label"
                      placeholder="e.g., Weight, Steps, Mood"
                      value={formData.label}
                      onChange={(e) =>
                        setFormData({ ...formData, label: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit (optional)</Label>
                    <Input
                      id="unit"
                      placeholder="e.g., kg, steps, /10"
                      value={formData.unit}
                      onChange={(e) =>
                        setFormData({ ...formData, unit: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddOpen(false);
                      setFormData({ label: "", unit: "" });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAdd} disabled={saving || !formData.label.trim()}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Metric
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {metrics.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No metrics defined yet.</p>
            <p className="text-sm">
              Add metrics to track quantitative data in your journal entries.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {metrics.map((metric) => (
              <div
                key={metric.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium">{metric.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {metric.unit && <span>Unit: {metric.unit}</span>}
                    {metric._count.postMetrics > 0 && (
                      <span className="ml-2">
                        ({metric._count.postMetrics} recorded values)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(metric)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(metric.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog
          open={!!editingMetric}
          onOpenChange={(open) => {
            if (!open) {
              setEditingMetric(null);
              setFormData({ label: "", unit: "" });
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Metric</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-label">Label</Label>
                <Input
                  id="edit-label"
                  value={formData.label}
                  onChange={(e) =>
                    setFormData({ ...formData, label: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-unit">Unit (optional)</Label>
                <Input
                  id="edit-unit"
                  value={formData.unit}
                  onChange={(e) =>
                    setFormData({ ...formData, unit: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingMetric(null);
                  setFormData({ label: "", unit: "" });
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={saving || !formData.label.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
