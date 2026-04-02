"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, Building2, Users, Globe } from "lucide-react";
import { createCompany, updateCompany, deleteCompany } from "@/lib/actions/companies";
import Link from "next/link";

const companyTypes = [
  { value: "employer", label: "Employer" },
  { value: "client", label: "Client" },
  { value: "partner", label: "Partner" },
  { value: "vendor", label: "Vendor" },
  { value: "prospect", label: "Prospect" },
  { value: "other", label: "Other" },
];

interface Company {
  id: string;
  name: string;
  website: string | null;
  type: string | null;
  _count?: { contacts: number };
}

interface CompanyFormProps {
  company?: Company;
  onSuccess?: () => void;
}

export function CompanyForm({ company, onSuccess }: CompanyFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(company?.name || "");
  const [website, setWebsite] = useState(company?.website || "");
  const [type, setType] = useState(company?.type || "");

  const isEdit = !!company;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit) {
        await updateCompany(company.id, { name, website, type });
      } else {
        await createCompany({ name, website, type });
      }
      setOpen(false);
      if (!isEdit) {
        setName("");
        setWebsite("");
        setType("");
      }
      onSuccess?.();
    } catch (error) {
      console.error("Error saving company:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon">
            <Edit className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Company
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Company" : "Create Company"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Company Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              type="url"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {companyTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CompanyCardProps {
  company: Company;
  onDelete?: () => void;
}

export function CompanyCard({ company, onDelete }: CompanyCardProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this company? Contacts will be unlinked but not deleted.")) return;
    setDeleting(true);
    try {
      await deleteCompany(company.id);
      onDelete?.();
    } catch (error) {
      console.error("Error deleting company:", error);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between">
        <Link href={`/companies/${company.id}`} className="flex-1 group">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
            <h3 className="font-medium group-hover:text-primary">{company.name}</h3>
          </div>
          
          {company.type && (
            <span className="inline-block mt-1 text-xs bg-muted px-2 py-0.5 rounded capitalize">
              {company.type}
            </span>
          )}
          
          {company.website && (
            <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
              <Globe className="h-3 w-3" />
              <span className="truncate">{company.website}</span>
            </div>
          )}
          
          <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{company._count?.contacts || 0} contacts</span>
          </div>
        </Link>
        
        <div className="flex items-center gap-1">
          <CompanyForm company={company} />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
