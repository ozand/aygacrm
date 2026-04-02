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
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  RotateCcw,
  Banknote,
} from "lucide-react";
import { createLoan, settleLoan, reopenLoan, deleteLoan } from "@/lib/actions/loans";

interface LoanContact {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

interface LoanItem {
  id: string;
  name: string;
  description: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  amount: any;
  currency: string;
  type: string;
  loanedAt: Date | null;
  settledAt: Date | null;
  loaner: LoanContact;
  loanee: LoanContact;
}

interface LoanFormProps {
  contactId: string;
  existingLoans: LoanItem[];
}

export function LoanForm({ contactId, existingLoans }: LoanFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [type, setType] = useState("lent");
  const [loanedAt, setLoanedAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !amount) {
      setError("Name and amount are required");
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("name", name);
    formData.set("amount", amount);
    formData.set("currency", currency);
    formData.set("type", type);
    if (description) formData.set("description", description);
    if (loanedAt) formData.set("loanedAt", loanedAt);

    startTransition(async () => {
      const result = await createLoan(formData);
      if (result.success) {
        setShowForm(false);
        resetForm();
      } else {
        setError(result.error || "Failed to add loan");
      }
    });
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setAmount("");
    setCurrency("USD");
    setType("lent");
    setLoanedAt("");
    setError(null);
  };

  const handleSettle = (loanId: string) => {
    startTransition(async () => {
      await settleLoan(loanId);
    });
  };

  const handleReopen = (loanId: string) => {
    startTransition(async () => {
      await reopenLoan(loanId);
    });
  };

  const handleDelete = (loanId: string) => {
    startTransition(async () => {
      await deleteLoan(loanId);
    });
  };

  const formatAmount = (loan: LoanItem) => {
    const num = Number(loan.amount);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: loan.currency || "USD",
    }).format(num);
  };

  // Separate active and settled loans
  const activeLoans = existingLoans.filter((l) => !l.settledAt);
  const settledLoans = existingLoans.filter((l) => l.settledAt);

  // Calculate totals
  const totalLent = activeLoans
    .filter((l) => l.type === "lent")
    .reduce((sum, l) => sum + Number(l.amount), 0);
  const totalBorrowed = activeLoans
    .filter((l) => l.type === "borrowed")
    .reduce((sum, l) => sum + Number(l.amount), 0);

  return (
    <div className={`space-y-4 ${isPending ? "opacity-50" : ""}`}>
      {/* Summary */}
      {activeLoans.length > 0 && (
        <div className="flex gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">You lent</p>
            <p className="text-lg font-semibold text-green-600">
              ${totalLent.toFixed(2)}
            </p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">You owe</p>
            <p className="text-lg font-semibold text-red-600">
              ${totalBorrowed.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Active loans */}
      {activeLoans.length > 0 && (
        <div className="space-y-2">
          {activeLoans.map((loan) => (
            <div
              key={loan.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  loan.type === "lent"
                    ? "bg-green-100 text-green-600"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {loan.type === "lent" ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownLeft className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {loan.name}
                  </span>
                  <Badge
                    variant="secondary"
                    className={
                      loan.type === "lent"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }
                  >
                    {loan.type === "lent" ? "Lent" : "Borrowed"}
                  </Badge>
                </div>
                {loan.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {loan.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm font-medium">{formatAmount(loan)}</span>
                  {loan.loanedAt && (
                    <span className="text-xs text-gray-500">
                      {new Date(loan.loanedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleSettle(loan.id)}
                  disabled={isPending}
                  className="h-8 w-8"
                  title="Mark as settled"
                >
                  <Check className="h-4 w-4 text-green-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(loan.id)}
                  disabled={isPending}
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settled loans (collapsed) */}
      {settledLoans.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
            Settled ({settledLoans.length})
          </summary>
          <div className="mt-2 space-y-2">
            {settledLoans.map((loan) => (
              <div
                key={loan.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-gray-50/50 dark:bg-gray-800/30 opacity-60"
              >
                <Banknote className="h-4 w-4 text-gray-400" />
                <span className="flex-1 text-sm line-through">
                  {loan.name} - {formatAmount(loan)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleReopen(loan.id)}
                  disabled={isPending}
                  className="h-6 w-6"
                  title="Reopen"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}

      {existingLoans.length === 0 && !showForm && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No loans or debts recorded. Track money you've lent or borrowed.
        </p>
      )}

      {/* Add loan form */}
      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 p-4 border rounded-lg"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="loanName">Description *</Label>
              <Input
                id="loanName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Dinner money"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loanType">Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lent">I lent (they owe me)</SelectItem>
                  <SelectItem value="borrowed">I borrowed (I owe them)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="loanAmount">Amount *</Label>
              <Input
                id="loanAmount"
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
              <Label htmlFor="loanCurrency">Currency</Label>
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
              <Label htmlFor="loanDate">Date</Label>
              <Input
                id="loanDate"
                type="date"
                value={loanedAt}
                onChange={(e) => setLoanedAt(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="loanDescription">Notes</Label>
            <Input
              id="loanDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional notes"
              disabled={isPending}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Loan
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
          Add Loan/Debt
        </Button>
      )}
    </div>
  );
}
