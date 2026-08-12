"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckSquare,
  Plus,
  Trash2,
  Loader2,
  Calendar,
  AlertCircle,
} from "lucide-react";
import {
  createTask,
  toggleTaskComplete,
  deleteTask,
} from "@/lib/actions/tasks";

interface Task {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  completedAt: Date | null;
  dueAt: Date | null;
  createdAt: Date;
}

interface TaskFormProps {
  contactId: string;
  existingTasks: Task[];
}

export function TaskForm({ contactId, existingTasks }: TaskFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!label.trim()) {
      setError("Task name is required");
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("name", label);
    formData.set("description", description);
    if (dueAt) {
      formData.set("dueAt", dueAt);
    }

    startTransition(async () => {
      const result = await createTask(formData);
      if (result.success) {
        setShowForm(false);
        setLabel("");
        setDescription("");
        setDueAt("");
      } else {
        setError(result.error || "Failed to create task");
      }
    });
  };

  const handleToggle = (taskId: string) => {
    startTransition(async () => {
      await toggleTaskComplete(taskId);
    });
  };

  const handleDelete = (taskId: string) => {
    startTransition(async () => {
      await deleteTask(taskId);
    });
  };

  const isOverdue = (task: Task) => {
    if (!task.dueAt || task.completed) return false;
    return new Date(task.dueAt) < new Date();
  };

  const formatDueDate = (date: Date | null) => {
    if (!date) return null;
    const d = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) {
      return "Today";
    }
    if (d.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const incompleteTasks = existingTasks.filter((t) => !t.completed);
  const completedTasks = existingTasks.filter((t) => t.completed);

  return (
    <div className={`space-y-4 ${isPending ? "opacity-50" : ""}`}>
      {/* Incomplete tasks */}
      {incompleteTasks.length > 0 && (
        <div className="space-y-2">
          {incompleteTasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-start gap-3 p-3 rounded-lg ${
                isOverdue(task)
                  ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  : "bg-gray-50 dark:bg-gray-800/50"
              }`}
            >
              <Checkbox
                checked={task.completed}
                onCheckedChange={() => handleToggle(task.id)}
                disabled={isPending}
                className="mt-0.5"
                aria-label={task.completed ? `Mark "${task.name}" as incomplete` : `Mark "${task.name}" as complete`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{task.name}</p>
                {task.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {task.description}
                  </p>
                )}
                {task.dueAt && (
                  <div
                    className={`flex items-center gap-1 mt-1 text-xs ${
                      isOverdue(task)
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {isOverdue(task) ? (
                      <AlertCircle className="h-3 w-3" />
                    ) : (
                      <Calendar className="h-3 w-3" />
                    )}
                    {formatDueDate(task.dueAt)}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(task.id)}
                disabled={isPending}
                className="h-8 w-8"
                aria-label={`Delete task "${task.name}"`}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
            Completed ({completedTasks.length})
          </h4>
          {completedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 opacity-60"
            >
              <Checkbox
                checked={task.completed}
                onCheckedChange={() => handleToggle(task.id)}
                disabled={isPending}
                className="mt-0.5"
                aria-label={task.completed ? `Mark "${task.name}" as incomplete` : `Mark "${task.name}" as complete`}
              />
              <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-through">{task.name}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(task.id)}
                disabled={isPending}
                className="h-8 w-8"
                aria-label={`Delete task "${task.name}"`}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {existingTasks.length === 0 && !showForm && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No tasks added yet.
        </p>
      )}

      {/* Add task form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
          <div className="space-y-2">
            <Label htmlFor="taskLabel">Task name *</Label>
            <Input
              id="taskLabel"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Call to wish happy birthday"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="taskDescription">Description</Label>
            <Input
              id="taskDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details..."
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="taskDueAt">Due date</Label>
            <Input
              id="taskDueAt"
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              disabled={isPending}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Task
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(false);
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
          Add Task
        </Button>
      )}
    </div>
  );
}
