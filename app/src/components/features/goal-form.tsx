"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Loader2,
  Target,
  Flame,
  Check,
  X,
  RotateCcw,
} from "lucide-react";
import { createGoal, updateGoal, deleteGoal } from "@/lib/actions/goals";

interface GoalItem {
  id: string;
  name: string;
  active: boolean;
  streakCount: number;
  createdAt: Date;
  streakEvents?: Array<{
    id: string;
    happenedAt: Date;
  }>;
}

interface GoalFormProps {
  contactId: string;
  existingGoals: GoalItem[];
}

export function GoalForm({ contactId, existingGoals }: GoalFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Goal name is required");
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("name", name);

    startTransition(async () => {
      const result = await createGoal(formData);
      if (result.success) {
        setShowForm(false);
        setName("");
      } else {
        setError(result.error || "Failed to add goal");
      }
    });
  };

  const handleIncrementStreak = (goalId: string) => {
    const formData = new FormData();
    formData.set("id", goalId);
    formData.set("incrementStreak", "true");

    startTransition(async () => {
      await updateGoal(formData);
    });
  };

  const handleResetStreak = (goalId: string) => {
    const formData = new FormData();
    formData.set("id", goalId);
    formData.set("resetStreak", "true");

    startTransition(async () => {
      await updateGoal(formData);
    });
  };

  const handleToggleActive = (goalId: string, currentActive: boolean) => {
    const formData = new FormData();
    formData.set("id", goalId);
    formData.set("active", (!currentActive).toString());

    startTransition(async () => {
      await updateGoal(formData);
    });
  };

  const handleDelete = (goalId: string) => {
    startTransition(async () => {
      await deleteGoal(goalId);
    });
  };

  // Separate active and inactive goals
  const activeGoals = existingGoals.filter((g) => g.active);
  const inactiveGoals = existingGoals.filter((g) => !g.active);

  return (
    <div className={`space-y-4 ${isPending ? "opacity-50" : ""}`}>
      {/* Active goals */}
      {activeGoals.length > 0 && (
        <div className="space-y-2">
          {activeGoals.map((goal) => (
            <div
              key={goal.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Target className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {goal.name}
                  </span>
                  {goal.streakCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="bg-orange-100 text-orange-800 flex items-center gap-1"
                    >
                      <Flame className="h-3 w-3" />
                      {goal.streakCount}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleIncrementStreak(goal.id)}
                  disabled={isPending}
                  className="h-8 w-8"
                  title="Add streak"
                >
                  <Flame className="h-4 w-4 text-orange-500" />
                </Button>
                {goal.streakCount > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleResetStreak(goal.id)}
                    disabled={isPending}
                    className="h-8 w-8"
                    title="Reset streak"
                  >
                    <RotateCcw className="h-4 w-4 text-gray-400" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggleActive(goal.id, goal.active)}
                  disabled={isPending}
                  className="h-8 w-8"
                  title="Mark as completed"
                >
                  <Check className="h-4 w-4 text-green-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(goal.id)}
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

      {/* Inactive/completed goals (collapsed) */}
      {inactiveGoals.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
            Completed ({inactiveGoals.length})
          </summary>
          <div className="mt-2 space-y-2">
            {inactiveGoals.map((goal) => (
              <div
                key={goal.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-gray-50/50 dark:bg-gray-800/30 opacity-60"
              >
                <Target className="h-4 w-4 text-gray-400" />
                <span className="flex-1 text-sm line-through">{goal.name}</span>
                {goal.streakCount > 0 && (
                  <span className="text-xs text-gray-400">
                    {goal.streakCount} streaks
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggleActive(goal.id, goal.active)}
                  disabled={isPending}
                  className="h-6 w-6"
                  title="Reactivate"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}

      {existingGoals.length === 0 && !showForm && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No goals set yet. Track habits and streaks for this contact.
        </p>
      )}

      {/* Add goal form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Call weekly, Send birthday card"
              disabled={isPending}
              autoFocus
            />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setShowForm(false);
              setName("");
              setError(null);
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          disabled={isPending}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Goal
        </Button>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
