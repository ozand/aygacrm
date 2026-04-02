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
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Mail, Phone, Globe, AtSign } from "lucide-react";
import {
  createContactInformationType,
  deleteContactInformationType,
  createAddressType,
  deleteAddressType,
} from "@/lib/actions/contact-info";

interface ContactInformationType {
  id: string;
  name: string;
  protocol: string | null;
  type: string;
}

interface AddressType {
  id: string;
  name: string;
}

interface ContactInfoTypeManagerProps {
  contactInfoTypes: ContactInformationType[];
  addressTypes: AddressType[];
}

const TYPE_OPTIONS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "phone", label: "Phone", icon: Phone },
  { value: "social", label: "Social Media", icon: AtSign },
  { value: "other", label: "Other", icon: Globe },
];

const PROTOCOL_SUGGESTIONS: Record<string, string> = {
  email: "mailto:",
  phone: "tel:",
  social: "https://",
  other: "",
};

export function ContactInfoTypeManager({
  contactInfoTypes,
  addressTypes,
}: ContactInfoTypeManagerProps) {
  const [isPending, startTransition] = useTransition();
  
  // Contact Info Type form
  const [newInfoName, setNewInfoName] = useState("");
  const [newInfoType, setNewInfoType] = useState("other");
  const [newInfoProtocol, setNewInfoProtocol] = useState("");
  
  // Address Type form
  const [newAddressName, setNewAddressName] = useState("");

  const handleCreateInfoType = () => {
    if (!newInfoName.trim()) return;

    startTransition(async () => {
      await createContactInformationType({
        name: newInfoName.trim(),
        type: newInfoType,
        protocol: newInfoProtocol || PROTOCOL_SUGGESTIONS[newInfoType],
      });
      setNewInfoName("");
      setNewInfoType("other");
      setNewInfoProtocol("");
    });
  };

  const handleDeleteInfoType = (id: string) => {
    if (!confirm("Delete this contact information type?")) return;
    startTransition(async () => {
      await deleteContactInformationType(id);
    });
  };

  const handleCreateAddressType = () => {
    if (!newAddressName.trim()) return;

    startTransition(async () => {
      await createAddressType(newAddressName.trim());
      setNewAddressName("");
    });
  };

  const handleDeleteAddressType = (id: string) => {
    if (!confirm("Delete this address type?")) return;
    startTransition(async () => {
      await deleteAddressType(id);
    });
  };

  const getTypeIcon = (type: string) => {
    const option = TYPE_OPTIONS.find((o) => o.value === type);
    return option?.icon || Globe;
  };

  return (
    <div className="space-y-6">
      {/* Contact Information Types */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing types */}
          {contactInfoTypes.length > 0 ? (
            <div className="space-y-2">
              {contactInfoTypes.map((infoType) => {
                const Icon = getTypeIcon(infoType.type);
                return (
                  <div
                    key={infoType.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{infoType.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {infoType.type}
                          </Badge>
                          {infoType.protocol && (
                            <span className="text-xs text-muted-foreground">
                              {infoType.protocol}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteInfoType(infoType.id)}
                      disabled={isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No contact information types defined yet.
            </p>
          )}

          {/* Add new type */}
          <div className="flex flex-col gap-2 pt-4 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Type name (e.g., Work Email)"
                value={newInfoName}
                onChange={(e) => setNewInfoName(e.target.value)}
                disabled={isPending}
                className="flex-1"
              />
              <Select value={newInfoType} onValueChange={setNewInfoType}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Protocol (optional, e.g., mailto:)"
                value={newInfoProtocol}
                onChange={(e) => setNewInfoProtocol(e.target.value)}
                disabled={isPending}
                className="flex-1"
              />
              <Button
                onClick={handleCreateInfoType}
                disabled={!newInfoName.trim() || isPending}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Types */}
      <Card>
        <CardHeader>
          <CardTitle>Address Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing types */}
          {addressTypes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {addressTypes.map((addrType) => (
                <div
                  key={addrType.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30"
                >
                  <span className="font-medium">{addrType.name}</span>
                  <button
                    onClick={() => handleDeleteAddressType(addrType.id)}
                    disabled={isPending}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No address types defined yet.
            </p>
          )}

          {/* Add new type */}
          <div className="flex gap-2 pt-4 border-t">
            <Input
              placeholder="Address type name (e.g., Home, Work)"
              value={newAddressName}
              onChange={(e) => setNewAddressName(e.target.value)}
              disabled={isPending}
              className="flex-1"
            />
            <Button
              onClick={handleCreateAddressType}
              disabled={!newAddressName.trim() || isPending}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
