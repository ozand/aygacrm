"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Settings } from "lucide-react";
import {
  createGroup,
  deleteGroup,
  createGroupType,
  deleteGroupType,
  createGroupTypeRole,
  deleteGroupTypeRole,
} from "@/lib/actions/groups";

interface GroupType {
  id: string;
  label: string;
  roles: Array<{
    id: string;
    label: string;
  }>;
}

interface Group {
  id: string;
  name: string;
  groupType: {
    id: string;
    label: string;
  } | null;
  contacts: Array<{
    contact: {
      id: string;
      firstName: string | null;
      lastName: string | null;
    };
    role: {
      id: string;
      label: string;
    } | null;
  }>;
}

interface GroupManagerProps {
  groups: Group[];
  groupTypes: GroupType[];
}

export function GroupManager({ groups, groupTypes }: GroupManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupTypeId, setNewGroupTypeId] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [selectedTypeForRole, setSelectedTypeForRole] = useState<string>("");

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;

    startTransition(async () => {
      await createGroup({
        name: newGroupName.trim(),
        groupTypeId: newGroupTypeId || undefined,
      });
      setNewGroupName("");
      setNewGroupTypeId("");
      setShowNewGroup(false);
    });
  };

  const handleDeleteGroup = (id: string) => {
    if (!confirm("Are you sure you want to delete this group?")) return;

    startTransition(async () => {
      await deleteGroup(id);
    });
  };

  const handleCreateGroupType = () => {
    if (!newTypeName.trim()) return;

    startTransition(async () => {
      await createGroupType(newTypeName.trim());
      setNewTypeName("");
    });
  };

  const handleDeleteGroupType = (id: string) => {
    if (!confirm("Are you sure you want to delete this group type?")) return;

    startTransition(async () => {
      await deleteGroupType(id);
    });
  };

  const handleCreateRole = () => {
    if (!newRoleName.trim() || !selectedTypeForRole) return;

    startTransition(async () => {
      await createGroupTypeRole(selectedTypeForRole, newRoleName.trim());
      setNewRoleName("");
    });
  };

  const handleDeleteRole = (id: string) => {
    startTransition(async () => {
      await deleteGroupTypeRole(id);
    });
  };

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={() => setShowNewGroup(!showNewGroup)}>
          <Plus className="w-4 h-4 mr-2" />
          New Group
        </Button>

        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              Manage Types & Roles
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Group Types & Roles</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Create new type */}
              <div className="space-y-2">
                <h4 className="font-medium">Create Group Type</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Type name (e.g., Family, Work Team)"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    disabled={isPending}
                  />
                  <Button
                    onClick={handleCreateGroupType}
                    disabled={!newTypeName.trim() || isPending}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Existing types */}
              {groupTypes.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium">Existing Types</h4>
                  {groupTypes.map((type) => (
                    <Card key={type.id}>
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {type.label}
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteGroupType(type.id)}
                            disabled={isPending}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="py-2">
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Roles:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {type.roles.length > 0 ? (
                              type.roles.map((role) => (
                                <div
                                  key={role.id}
                                  className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm"
                                >
                                  {role.label}
                                  <button
                                    onClick={() => handleDeleteRole(role.id)}
                                    disabled={isPending}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                No roles defined
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Add role to type */}
              {groupTypes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Add Role to Type</h4>
                  <div className="flex gap-2">
                    <Select
                      value={selectedTypeForRole}
                      onValueChange={setSelectedTypeForRole}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {groupTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Role name (e.g., Leader, Member)"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      disabled={isPending}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleCreateRole}
                      disabled={
                        !newRoleName.trim() || !selectedTypeForRole || isPending
                      }
                    >
                      Add Role
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* New group form */}
      {showNewGroup && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <Input
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                disabled={isPending}
                className="flex-1"
              />
              {groupTypes.length > 0 && (
                <Select
                  value={newGroupTypeId}
                  onValueChange={(v) =>
                    setNewGroupTypeId(v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No type</SelectItem>
                    {groupTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || isPending}
              >
                Create
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowNewGroup(false);
                  setNewGroupName("");
                  setNewGroupTypeId("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
