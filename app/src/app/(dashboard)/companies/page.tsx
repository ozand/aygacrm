export const dynamic = 'force-dynamic';

import { getCompanies } from "@/lib/actions/companies";
import { CompanyForm, CompanyCard } from "@/components/features/company-form";
import { Building2 } from "lucide-react";

export default async function CompaniesPage() {
  const companies = await getCompanies();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Companies</h1>
          <p className="text-muted-foreground">
            Manage companies and their associated contacts
          </p>
        </div>
        <CompanyForm />
      </div>

      {companies.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No companies yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first company to organize contacts
          </p>
          <CompanyForm />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      )}
    </div>
  );
}
