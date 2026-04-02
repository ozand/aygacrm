"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLabel, updateLabel, deleteLabel } from "@/lib/actions/labels";
import { Loader2, Save, Trash2 } from "lucide-react";

interface LabelFormProps {
  label?: {
    id: string;
    name: string;
    description?: string | null;
    bgColor: string;
    textColor: string;
  };
  mode?: "create" | "edit";
  onSuccess?: () => void;
}

const PRESET_COLORS = [
  { bg: "#dbeafe", text: "#1e40af", name: "Blue" },
  { bg: "#dcfce7", text: "#166534", name: "Green" },
  { bg: "#fef3c7", text: "#92400e", name: "Yellow" },
  { bg: "#fee2e2", text: "#991b1b", name: "Red" },
  { bg: "#f3e8ff", text: "#7e22ce", name: "Purple" },
  { bg: "#fce7f3", text: "#9d174d", name: "Pink" },
  { bg: "#e5e7eb", text: "#1f2937", name: "Gray" },
  { bg: "#ffedd5", text: "#9a3412", name: "Orange" },
];

export function LabelForm({ label, mode = "create", onSuccess }: LabelFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(
    label
      ? PRESET_COLORS.findIndex(
          (c) => c.bg === label.bgColor && c.text === label.textColor
        )
      : 0
  );

  async function handleSubmit(formData: FormData) {
    setError(null);

    const color = PRESET_COLORS[selectedColor] || PRESET_COLORS[0];
    formData.set("bgColor", color.bg);
    formData.set("textColor", color.text);

    startTransition(async () => {
      let result;

      if (mode === "create") {
        result = await createLabel(formData);
      } else {
        result = await updateLabel(label!.id, formData);
      }

      if (result.success) {
        onSuccess?.();
        if (mode === "create") {
          // Reset form
          const form = document.getElementById("label-form") as HTMLFormElement;
          form?.reset();
          router.refresh();
        } else {
          router.push("/labels");
        }
      } else {
        setError(result.error || "An error occurred");
      }
    });
  }

  async function handleDelete() {
    if (!label) return;
    if (!confirm("Are you sure you want to delete this label?")) return;

    startTransition(async () => {
      const result = await deleteLabel(label.id);
      if (result.success) {
        router.push("/labels");
      } else {
        setError(result.error || "Failed to delete label");
      }
    });
  }

  return (
    <form id="label-form" action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Label Name</Label>
          <Input
            id="name"
            name="name"
            placeholder="e.g., Family, Work, VIP"
            defaultValue={label?.name || ""}
            disabled={isPending}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Input
            id="description"
            name="description"
            placeholder="Short description"
            defaultValue={label?.description || ""}
            disabled={isPending}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((color, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setSelectedColor(index)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                selectedColor === index
                  ? "border-gray-900 dark:border-white scale-110"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: color.bg }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Preview:</span>
        <span
          className="px-3 py-1 rounded-full text-sm font-medium"
          style={{
            backgroundColor: PRESET_COLORS[selectedColor]?.bg,
            color: PRESET_COLORS[selectedColor]?.text,
          }}
        >
          Label
        </span>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex items-center justify-between">
        {mode === "edit" && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        )}
        <div className={mode === "create" ? "ml-auto" : ""}>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "create" ? "Creating..." : "Saving..."}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {mode === "create" ? "Create Label" : "Save Changes"}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
