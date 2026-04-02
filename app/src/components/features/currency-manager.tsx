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
import { Plus, Pencil, Trash2, DollarSign, Loader2 } from "lucide-react";
import {
  getCurrencies,
  createCurrency,
  updateCurrency,
  deleteCurrency,
  seedCurrencies,
} from "@/lib/actions/currencies";

interface Currency {
  id: string;
  code: string;
  name: string;
}

export function CurrencyManager() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [formData, setFormData] = useState({ code: "", name: "" });
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadCurrencies();
  }, []);

  async function loadCurrencies() {
    try {
      const data = await getCurrencies();
      setCurrencies(data);
    } catch (error) {
      console.error("Error loading currencies:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSeedDefaults() {
    setSaving(true);
    try {
      await seedCurrencies();
      await loadCurrencies();
    } catch (error) {
      console.error("Error seeding defaults:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    if (!formData.code.trim() || !formData.name.trim()) return;

    setSaving(true);
    try {
      const currency = await createCurrency({
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
      });
      setCurrencies([...currencies, currency].sort((a, b) => a.code.localeCompare(b.code)));
      setFormData({ code: "", name: "" });
      setIsAddOpen(false);
    } catch (error) {
      console.error("Error creating currency:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editingCurrency || !formData.code.trim() || !formData.name.trim()) return;

    setSaving(true);
    try {
      await updateCurrency(editingCurrency.id, {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
      });
      setCurrencies(
        currencies
          .map((c) =>
            c.id === editingCurrency.id
              ? { ...c, code: formData.code.trim().toUpperCase(), name: formData.name.trim() }
              : c
          )
          .sort((a, b) => a.code.localeCompare(b.code))
      );
      setEditingCurrency(null);
      setFormData({ code: "", name: "" });
    } catch (error) {
      console.error("Error updating currency:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this currency?")) {
      return;
    }

    try {
      await deleteCurrency(id);
      setCurrencies(currencies.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Error deleting currency:", error);
    }
  }

  function openEdit(currency: Currency) {
    setEditingCurrency(currency);
    setFormData({ code: currency.code, name: currency.name });
  }

  const filteredCurrencies = currencies.filter(
    (c) =>
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Currencies
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
              <DollarSign className="h-5 w-5" />
              Currencies
            </CardTitle>
            <CardDescription>
              Manage available currencies for gifts and loans
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {currencies.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedDefaults}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Common Currencies
              </Button>
            )}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Currency
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Currency</DialogTitle>
                  <DialogDescription>
                    Add a new currency code for use with gifts and loans.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Currency Code</Label>
                    <Input
                      id="code"
                      placeholder="e.g., USD, EUR, GBP"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({ ...formData, code: e.target.value.toUpperCase() })
                      }
                      maxLength={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Currency Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., US Dollar, Euro"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddOpen(false);
                      setFormData({ code: "", name: "" });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAdd}
                    disabled={saving || !formData.code.trim() || !formData.name.trim()}
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Currency
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {currencies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No currencies defined yet.</p>
            <p className="text-sm">
              Add currencies to use with gifts and loans.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {currencies.length > 10 && (
              <Input
                placeholder="Search currencies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCurrencies.map((currency) => (
                <div
                  key={currency.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div>
                    <span className="font-mono font-medium">{currency.code}</span>
                    <span className="text-muted-foreground ml-2 text-sm">
                      {currency.name}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(currency)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(currency.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {filteredCurrencies.length === 0 && searchTerm && (
              <p className="text-center text-muted-foreground py-4">
                No currencies match &quot;{searchTerm}&quot;
              </p>
            )}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog
          open={!!editingCurrency}
          onOpenChange={(open) => {
            if (!open) {
              setEditingCurrency(null);
              setFormData({ code: "", name: "" });
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Currency</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-code">Currency Code</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Currency Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingCurrency(null);
                  setFormData({ code: "", name: "" });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={saving || !formData.code.trim() || !formData.name.trim()}
              >
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
