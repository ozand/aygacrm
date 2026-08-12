// Available template module types.
// Kept outside the "use server" actions module — server action files may only
// export async functions.
export const MODULE_TYPES = [
  { type: "notes", label: "Notes", description: "Contact notes" },
  { type: "activities", label: "Activities", description: "Logged activities and interactions" },
  { type: "reminders", label: "Reminders", description: "Important date reminders" },
  { type: "tasks", label: "Tasks", description: "Tasks related to contact" },
  { type: "calls", label: "Calls", description: "Call history" },
  { type: "gifts", label: "Gifts", description: "Gift ideas and history" },
  { type: "debts", label: "Debts/Loans", description: "Money owed or lent" },
  { type: "documents", label: "Documents", description: "Attached files" },
  { type: "photos", label: "Photos", description: "Photo gallery" },
  { type: "relationships", label: "Relationships", description: "Family and friend connections" },
  { type: "pets", label: "Pets", description: "Contact's pets" },
  { type: "addresses", label: "Addresses", description: "Physical addresses" },
  { type: "contact_info", label: "Contact Information", description: "Email, phone, social" },
  { type: "important_dates", label: "Important Dates", description: "Birthdays, anniversaries" },
  { type: "life_events", label: "Life Events", description: "Major life milestones" },
  { type: "goals", label: "Goals", description: "Personal goals" },
  { type: "hobbies", label: "Hobbies", description: "Interests and activities" },
  { type: "work", label: "Work Info", description: "Job and company details" },
  { type: "quick_facts", label: "Quick Facts", description: "Key information at a glance" },
] as const;
