"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Plus, X, UserCog } from "lucide-react";
import {
  addContactToGroup,
  removeContactFromGroup,
  updateContactGroupRole,
} from "@/lib/actions/groups";

interface Group {
  id: string;
  name: string;
  groupType: {
    id: string;
    label: string;
    roles: Array<{
      id: string;
      label: string;
    }>;
  } | null;
}

interface ContactGroupMembership {
  contactId: string;
  groupId: string;
  group: {
    id: string;
    name: string;
    groupType: {
      id: string;
      label: string;
    } | null;
  };
  role: {
    id: string;
    label: string;
  } | null;
}

interface ContactGroupFormProps {
  contactId: string;
  groups: Group[];
  contactGroups: ContactGroupMembership[];
}

export function ContactGroupForm({
  contactId,
  groups,
  contactGroups,
}: ContactGroupFormProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [showRoleSelector, setShowRoleSelector] = useState<string | null>(null);

  // Groups the contact is NOT a member of
  const availableGroups = groups.filter(
    (g) => !contactGroups.some((cg) => cg.groupId === g.id)
  );

  const handleAddToGroup = () => {
    if (!selectedGroupId) return;

    startTransition(async () => {
      await addContactToGroup(contactId, selectedGroupId);
      setSelectedGroupId("");
    });
  };

  const handleRemoveFromGroup = (groupId: string) => {
    startTransition(async () => {
      await removeContactFromGroup(contactId, groupId);
    });
  };

  const handleUpdateRole = (groupId: string, roleId: string) => {
    startTransition(async () => {
      await updateContactGroupRole(
        contactId,
        groupId,
        roleId === "none" ? null : roleId
      );
      setShowRoleSelector(null);
    });
  };

  // Get available roles for a group
  const getRolesForGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    return group?.groupType?.roles || [];
  };

  return (
    <div className="space-y-4">
      {/* Current memberships */}
      {contactGroups.length > 0 ? (
        <div className="space-y-2">
          {contactGroups.map((cg) => {
            const roles = getRolesForGroup(cg.groupId);
            const isEditingRole = showRoleSelector === cg.groupId;

            return (
              <div
                key={cg.groupId}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{cg.group.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {cg.group.groupType && (
                        <span>{cg.group.groupType.label}</span>
                      )}
                      {cg.role && (
                        <Badge variant="secondary" className="text-xs">
                          {cg.role.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Role selector */}
                  {roles.length > 0 && (
                    <>
                      {isEditingRole ? (
                        <Select
                          value={cg.role?.id || "none"}
                          onValueChange={(value) =>
                            handleUpdateRole(cg.groupId, value)
                          }
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No role</SelectItem>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowRoleSelector(cg.groupId)}
                          disabled={isPending}
                        >
                          <UserCog className="w-4 h-4" />
                        </Button>
                      )}
                    </>
                  )}

                  {/* Remove button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFromGroup(cg.groupId)}
                    disabled={isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          This contact is not a member of any groups.
        </p>
      )}

      {/* Add to group */}
      {availableGroups.length > 0 && (
        <div className="flex gap-2">
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a group..." />
            </SelectTrigger>
            <SelectContent>
              {availableGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  <div className="flex items-center gap-2">
                    <span>{group.name}</span>
                    {group.groupType && (
                      <span className="text-muted-foreground text-xs">
                        ({group.groupType.label})
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleAddToGroup}
            disabled={!selectedGroupId || isPending}
            size="icon"
            aria-label="Add to group"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* No groups available message */}
      {availableGroups.length === 0 && groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No groups have been created yet. Create groups in the Groups section.
        </p>
      )}

      {availableGroups.length === 0 && groups.length > 0 && contactGroups.length > 0 && (
        <p className="text-sm text-muted-foreground">
          This contact is a member of all available groups.
        </p>
      )}
    </div>
  );
}
