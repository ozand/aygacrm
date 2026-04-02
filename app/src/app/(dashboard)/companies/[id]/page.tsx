export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import Link from "next/link";
import { getCompany, getUnassignedContacts } from "@/lib/actions/companies";
import { CompanyForm } from "@/components/features/company-form";
import { CompanyContacts } from "@/components/features/company-contacts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2, Globe, Users } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params;
  const [company, unassignedContacts] = await Promise.all([
    getCompany(id),
    getUnassignedContacts(),
  ]);

  if (!company) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/companies">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">{company.name}</h1>
              {company.type && (
                <span className="inline-block mt-1 text-sm bg-muted px-2 py-0.5 rounded capitalize">
                  {company.type}
                </span>
              )}
            </div>
          </div>
        </div>
        <CompanyForm company={company} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {company.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {company.website}
                </a>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{company.contacts.length} contacts</span>
            </div>
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Contacts at {company.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <CompanyContacts
              companyId={company.id}
              contacts={company.contacts}
              unassignedContacts={unassignedContacts}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
