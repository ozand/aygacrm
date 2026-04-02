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
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Loader2,
  Gift,
  ExternalLink,
  Lightbulb,
  Calendar,
  Check,
  Package,
} from "lucide-react";
import { createGift, updateGiftStatus, deleteGift } from "@/lib/actions/gifts";

interface GiftOccasion {
  id: string;
  label: string;
}

interface GiftItem {
  id: string;
  name: string;
  description: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  amount: any;
  currency: string | null;
  url: string | null;
  status: string;
  date: Date | null;
  occasion: GiftOccasion | null;
}

interface GiftFormProps {
  contactId: string;
  occasions: GiftOccasion[];
  existingGifts: GiftItem[];
}

const STATUS_OPTIONS = [
  { value: "idea", label: "Idea", icon: Lightbulb, color: "bg-yellow-100 text-yellow-800" },
  { value: "planned", label: "Planned", icon: Calendar, color: "bg-blue-100 text-blue-800" },
  { value: "given", label: "Given", icon: Gift, color: "bg-green-100 text-green-800" },
  { value: "received", label: "Received", icon: Package, color: "bg-purple-100 text-purple-800" },
];

export function GiftForm({
  contactId,
  occasions,
  existingGifts,
}: GiftFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idea");
  const [date, setDate] = useState("");
  const [occasionId, setOccasionId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Gift name is required");
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("name", name);
    formData.set("status", status);
    if (description) formData.set("description", description);
    if (amount) formData.set("amount", amount);
    if (currency) formData.set("currency", currency);
    if (url) formData.set("url", url);
    if (date) formData.set("date", date);
    if (occasionId) formData.set("occasionId", occasionId);

    startTransition(async () => {
      const result = await createGift(formData);
      if (result.success) {
        setShowForm(false);
        resetForm();
      } else {
        setError(result.error || "Failed to add gift");
      }
    });
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setAmount("");
    setCurrency("USD");
    setUrl("");
    setStatus("idea");
    setDate("");
    setOccasionId("");
    setError(null);
  };

  const handleStatusChange = (giftId: string, newStatus: string) => {
    startTransition(async () => {
      await updateGiftStatus(giftId, newStatus);
    });
  };

  const handleDelete = (giftId: string) => {
    startTransition(async () => {
      await deleteGift(giftId);
    });
  };

  const getStatusBadge = (statusValue: string) => {
    const statusOption = STATUS_OPTIONS.find((s) => s.value === statusValue);
    if (!statusOption) return null;
    return (
      <Badge variant="secondary" className={statusOption.color}>
        {statusOption.label}
      </Badge>
    );
  };

  const formatAmount = (gift: GiftItem) => {
    if (!gift.amount) return null;
    const num = Number(gift.amount);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: gift.currency || "USD",
    }).format(num);
  };

  // Group gifts by status
  const giftsByStatus = {
    idea: existingGifts.filter((g) => g.status === "idea"),
    planned: existingGifts.filter((g) => g.status === "planned"),
    given: existingGifts.filter((g) => g.status === "given"),
    received: existingGifts.filter((g) => g.status === "received"),
  };

  return (
    <div className={`space-y-4 ${isPending ? "opacity-50" : ""}`}>
      {/* Existing gifts */}
      {existingGifts.length > 0 ? (
        <div className="space-y-3">
          {existingGifts.map((gift) => (
            <div
              key={gift.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Gift className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {gift.name}
                  </span>
                  {getStatusBadge(gift.status)}
                  {gift.occasion && (
                    <Badge variant="outline" className="text-xs">
                      {gift.occasion.label}
                    </Badge>
                  )}
                </div>
                {gift.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {gift.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {formatAmount(gift) && <span>{formatAmount(gift)}</span>}
                  {gift.date && (
                    <span>
                      {new Date(gift.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  )}
                  {gift.url && (
                    <a
                      href={gift.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Link
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Select
                  value={gift.status}
                  onValueChange={(value) => handleStatusChange(gift.id, value)}
                >
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(gift.id)}
                  disabled={isPending}
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No gifts added yet. Track gift ideas and what you've given or received.
          </p>
        )
      )}

      {/* Add gift form */}
      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 p-4 border rounded-lg"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="giftName">Gift Name *</Label>
              <Input
                id="giftName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Book about cooking"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="giftStatus">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="giftDescription">Description</Label>
            <Input
              id="giftDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes about the gift"
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="giftAmount">Amount</Label>
              <Input
                id="giftAmount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="giftCurrency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="RUB">RUB</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="giftOccasion">Occasion</Label>
              <Select value={occasionId} onValueChange={setOccasionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {occasions.map((occ) => (
                    <SelectItem key={occ.id} value={occ.id}>
                      {occ.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="giftDate">Date</Label>
              <Input
                id="giftDate"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="giftUrl">URL</Label>
              <Input
                id="giftUrl"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                disabled={isPending}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Gift
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(false);
                resetForm();
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
          Add Gift
        </Button>
      )}
    </div>
  );
}
