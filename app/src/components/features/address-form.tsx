"use client";

import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, MapPin, Pencil, Trash2, ExternalLink } from "lucide-react";
import { createAddress, updateAddress, deleteAddress } from "@/lib/actions/addresses";

interface AddressType {
  id: string;
  name: string;
}

interface Address {
  id: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  isActive: boolean;
  addressTypeId: string | null;
  addressType: AddressType | null;
}

interface AddressFormProps {
  contactId: string;
  addressTypes: AddressType[];
  existingAddresses: Address[];
}

export function AddressForm({
  contactId,
  addressTypes,
  existingAddresses,
}: AddressFormProps) {
  const [addresses, setAddresses] = useState<Address[]>(existingAddresses);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [addressTypeId, setAddressTypeId] = useState("");

  const resetForm = () => {
    setLine1("");
    setLine2("");
    setCity("");
    setProvince("");
    setPostalCode("");
    setCountry("");
    setAddressTypeId("");
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!line1 && !city && !country) return;

    setLoading(true);
    try {
      if (editingId) {
        const updated = await updateAddress(editingId, {
          line1,
          line2,
          city,
          province,
          postalCode,
          country,
          addressTypeId: addressTypeId || undefined,
        });
        setAddresses(addresses.map((a) => (a.id === editingId ? updated : a)));
        setEditingId(null);
      } else {
        const newAddress = await createAddress({
          contactId,
          line1,
          line2,
          city,
          province,
          postalCode,
          country,
          addressTypeId: addressTypeId || undefined,
        });
        setAddresses([newAddress, ...addresses]);
        setIsAddOpen(false);
      }
      resetForm();
    } catch (error) {
      console.error("Error saving address:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (address: Address) => {
    setLine1(address.line1 || "");
    setLine2(address.line2 || "");
    setCity(address.city || "");
    setProvince(address.province || "");
    setPostalCode(address.postalCode || "");
    setCountry(address.country || "");
    setAddressTypeId(address.addressTypeId || "");
    setEditingId(address.id);
    setIsAddOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this address?")) return;
    try {
      await deleteAddress(id);
      setAddresses(addresses.filter((a) => a.id !== id));
    } catch (error) {
      console.error("Error deleting address:", error);
    }
  };

  const formatAddress = (address: Address) => {
    return [
      address.line1,
      address.line2,
      [address.city, address.province].filter(Boolean).join(", "),
      address.postalCode,
      address.country,
    ]
      .filter(Boolean)
      .join(", ");
  };

  const getMapUrl = (address: Address) => {
    const parts = [
      address.line1,
      address.city,
      address.province,
      address.postalCode,
      address.country,
    ].filter(Boolean);
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(parts.join(", "))}`;
  };

  const AddressFormFields = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="addressType">Type</Label>
        <Select value={addressTypeId} onValueChange={setAddressTypeId}>
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {addressTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="line1">Address Line 1</Label>
        <Input
          id="line1"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          placeholder="Street address"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="line2">Address Line 2</Label>
        <Input
          id="line2"
          value={line2}
          onChange={(e) => setLine2(e.target.value)}
          placeholder="Apt, suite, unit, etc."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="province">State/Province</Label>
          <Input
            id="province"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            placeholder="State/Province"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal Code</Label>
          <Input
            id="postalCode"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder="Postal code"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            resetForm();
            setIsAddOpen(false);
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading || (!line1 && !city && !country)}>
          {loading ? "Saving..." : editingId ? "Update" : "Add Address"}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      {addresses.length > 0 ? (
        <div className="space-y-3">
          {addresses.map((address) => (
            <div
              key={address.id}
              className="group flex items-start justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  {address.addressType && (
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1 block">
                      {address.addressType.name}
                    </span>
                  )}
                  <p className="text-sm">{formatAddress(address)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  asChild
                >
                  <a
                    href={getMapUrl(address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on map"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleEdit(address)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(address.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-sm italic">
          No addresses added yet.
        </p>
      )}

      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) resetForm();
      }}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Address
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Address" : "Add Address"}
            </DialogTitle>
          </DialogHeader>
          <AddressFormFields />
        </DialogContent>
      </Dialog>
    </div>
  );
}
