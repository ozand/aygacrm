"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Edit2, X, Check, Mail, Phone, Globe, AtSign } from "lucide-react";
import {
  createContactInformation,
  updateContactInformation,
  deleteContactInformation,
} from "@/lib/actions/contact-info";

interface ContactInformationType {
  id: string;
  name: string;
  protocol: string | null;
  type: string;
}

interface ContactInfo {
  id: string;
  data: string;
  label: string | null;
  type: ContactInformationType;
}

interface ContactInfoFormProps {
  contactId: string;
  infoTypes: ContactInformationType[];
  existingInfo: ContactInfo[];
}

export function ContactInfoForm({
  contactId,
  infoTypes,
  existingInfo,
}: ContactInfoFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // New info form
  const [newTypeId, setNewTypeId] = useState("");
  const [newData, setNewData] = useState("");
  const [newLabel, setNewLabel] = useState("");
  
  // Edit form
  const [editData, setEditData] = useState("");
  const [editLabel, setEditLabel] = useState("");

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "email":
        return Mail;
      case "phone":
        return Phone;
      case "social":
        return AtSign;
      default:
        return Globe;
    }
  };

  const handleAdd = () => {
    if (!newTypeId || !newData.trim()) return;

    startTransition(async () => {
      await createContactInformation({
        contactId,
        typeId: newTypeId,
        data: newData.trim(),
        label: newLabel.trim() || undefined,
      });
      setNewTypeId("");
      setNewData("");
      setNewLabel("");
      setShowAddForm(false);
    });
  };

  const handleStartEdit = (info: ContactInfo) => {
    setEditingId(info.id);
    setEditData(info.data);
    setEditLabel(info.label || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData("");
    setEditLabel("");
  };

  const handleSaveEdit = (id: string) => {
    if (!editData.trim()) return;

    startTransition(async () => {
      await updateContactInformation(id, {
        data: editData.trim(),
        label: editLabel.trim() || undefined,
      });
      handleCancelEdit();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this contact information?")) return;

    startTransition(async () => {
      await deleteContactInformation(id);
    });
  };

  // Group info by type
  const emailInfo = existingInfo.filter((i) => i.type.type === "email");
  const phoneInfo = existingInfo.filter((i) => i.type.type === "phone");
  const otherInfo = existingInfo.filter(
    (i) => i.type.type !== "email" && i.type.type !== "phone"
  );

  const renderInfoItem = (info: ContactInfo) => {
    const Icon = getTypeIcon(info.type.type);
    const isEditing = editingId === info.id;

    if (isEditing) {
      return (
        <div key={info.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted">
          <Input
            value={editData}
            onChange={(e) => setEditData(e.target.value)}
            placeholder="Value"
            className="flex-1"
            disabled={isPending}
          />
          <Input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            placeholder="Label (optional)"
            className="w-32"
            disabled={isPending}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSaveEdit(info.id)}
            disabled={isPending || !editData.trim()}
          >
            <Check className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancelEdit}
            disabled={isPending}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      );
    }

    const href =
      info.type.protocol && info.data
        ? `${info.type.protocol}${info.data}`
        : null;

    return (
      <div
        key={info.id}
        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 group"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <div>
            {href ? (
              <a
                href={href}
                className="text-primary hover:underline font-medium"
              >
                {info.data}
              </a>
            ) : (
              <span className="font-medium">{info.data}</span>
            )}
            {(info.label || info.type.name) && (
              <span className="text-xs text-muted-foreground ml-2">
                {info.label || info.type.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleStartEdit(info)}
            disabled={isPending}
            aria-label="Edit contact information"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(info.id)}
            disabled={isPending}
            className="text-destructive hover:text-destructive"
            aria-label="Delete contact information"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Emails */}
      {emailInfo.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Email
          </h4>
          <div className="space-y-1">{emailInfo.map(renderInfoItem)}</div>
        </div>
      )}

      {/* Phones */}
      {phoneInfo.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Phone
          </h4>
          <div className="space-y-1">{phoneInfo.map(renderInfoItem)}</div>
        </div>
      )}

      {/* Other */}
      {otherInfo.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Other
          </h4>
          <div className="space-y-1">{otherInfo.map(renderInfoItem)}</div>
        </div>
      )}

      {existingInfo.length === 0 && !showAddForm && (
        <p className="text-sm text-muted-foreground italic">
          No contact information added yet.
        </p>
      )}

      {/* Add form */}
      {showAddForm ? (
        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
          <div className="flex gap-2">
            <Select value={newTypeId} onValueChange={setNewTypeId}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {infoTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Value (email, phone, etc.)"
              value={newData}
              onChange={(e) => setNewData(e.target.value)}
              disabled={isPending}
              className="flex-1"
            />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Label (optional, e.g., Personal)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              disabled={isPending}
              className="flex-1"
            />
            <Button
              onClick={handleAdd}
              disabled={!newTypeId || !newData.trim() || isPending}
            >
              Add
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowAddForm(false);
                setNewTypeId("");
                setNewData("");
                setNewLabel("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
          disabled={infoTypes.length === 0}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Contact Info
        </Button>
      )}

      {infoTypes.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Configure contact information types in Settings first.
        </p>
      )}
    </div>
  );
}
