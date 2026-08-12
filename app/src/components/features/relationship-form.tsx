"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Users, Plus, Trash2, Loader2, Link as LinkIcon } from "lucide-react";
import { createRelationship, deleteRelationship } from "@/lib/actions/relationships";

interface Contact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
}

interface RelationshipType {
  id: string;
  name: string;
  nameReverseRelationship: string | null;
}

interface RelationshipGroupType {
  id: string;
  name: string;
  type: string | null;
  relationshipTypes: RelationshipType[];
}

interface Relationship {
  id: string;
  direction: "from" | "to";
  relatedContact: Contact;
  type: string;
  reverseType: string | null;
  groupType: string;
}

interface RelationshipFormProps {
  contactId: string;
  contacts: Contact[];
  relationshipTypes: RelationshipGroupType[];
  existingRelationships: Relationship[];
}

export function RelationshipForm({
  contactId,
  contacts,
  relationshipTypes,
  existingRelationships,
}: RelationshipFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const getContactName = (contact: Contact) => {
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
    return name || contact.nickname || "Unnamed Contact";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedContactId) {
      setError("Please select a contact");
      return;
    }

    if (!selectedTypeId) {
      setError("Please select a relationship type");
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("relatedContactId", selectedContactId);
    formData.set("relationshipTypeId", selectedTypeId);

    startTransition(async () => {
      const result = await createRelationship(formData);
      if (result.success) {
        setShowForm(false);
        setSelectedContactId("");
        setSelectedTypeId("");
      } else {
        setError(result.error || "Failed to create relationship");
      }
    });
  };

  const handleDelete = (relationshipId: string) => {
    startTransition(async () => {
      const result = await deleteRelationship(relationshipId);
      if (!result.success) {
        setError(result.error || "Failed to delete relationship");
      }
    });
  };

  // Group relationships by group type for display
  const groupedRelationships = existingRelationships.reduce((acc, rel) => {
    if (!acc[rel.groupType]) {
      acc[rel.groupType] = [];
    }
    acc[rel.groupType].push(rel);
    return acc;
  }, {} as Record<string, Relationship[]>);

  return (
    <div className={`space-y-4 ${isPending ? "opacity-50" : ""}`}>
      {/* Existing relationships */}
      {existingRelationships.length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedRelationships).map(([groupName, relationships]) => (
            <div key={groupName}>
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                {groupName}
              </h4>
              <div className="space-y-2">
                {relationships.map((relationship) => (
                  <div
                    key={relationship.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <LinkIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {getContactName(relationship.relatedContact)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {relationship.type}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(relationship.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No relationships added yet.
        </p>
      )}

      {/* Add relationship form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
          <div className="space-y-2">
            <Label htmlFor="relatedContact">Related Contact</Label>
            <Select value={selectedContactId} onValueChange={setSelectedContactId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a contact" />
              </SelectTrigger>
              <SelectContent>
                {contacts.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No other contacts available
                  </SelectItem>
                ) : (
                  contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {getContactName(contact)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="relationshipType">Relationship Type</Label>
            <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select relationship type" />
              </SelectTrigger>
              <SelectContent>
                {relationshipTypes.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No relationship types available
                  </SelectItem>
                ) : (
                  relationshipTypes.map((group) => (
                    <SelectGroup key={group.id}>
                      <SelectLabel>{group.name}</SelectLabel>
                      {group.relationshipTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                          {type.nameReverseRelationship &&
                            type.nameReverseRelationship !== type.name &&
                            ` / ${type.nameReverseRelationship}`}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Relationship
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
          disabled={isPending || contacts.length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Relationship
        </Button>
      )}

      {contacts.length === 0 && !showForm && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Add more contacts to create relationships.
        </p>
      )}
    </div>
  );
}
