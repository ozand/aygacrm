// Available abilities for API tokens.
// Kept outside the "use server" actions module — server action files may only
// export async functions.
export const API_ABILITIES = [
  { value: "*", label: "Full Access", description: "All permissions" },
  { value: "contacts:read", label: "Read Contacts", description: "View contacts and their details" },
  { value: "contacts:write", label: "Write Contacts", description: "Create and update contacts" },
  { value: "contacts:delete", label: "Delete Contacts", description: "Delete contacts" },
  { value: "notes:read", label: "Read Notes", description: "View notes" },
  { value: "notes:write", label: "Write Notes", description: "Create and update notes" },
  { value: "notes:delete", label: "Delete Notes", description: "Delete notes" },
  { value: "activities:read", label: "Read Activities", description: "View activities" },
  { value: "activities:write", label: "Write Activities", description: "Create and update activities" },
  { value: "activities:delete", label: "Delete Activities", description: "Delete activities" },
  { value: "reminders:read", label: "Read Reminders", description: "View reminders" },
  { value: "reminders:write", label: "Write Reminders", description: "Create and update reminders" },
  { value: "reminders:delete", label: "Delete Reminders", description: "Delete reminders" },
  { value: "tasks:read", label: "Read Tasks", description: "View tasks" },
  { value: "tasks:write", label: "Write Tasks", description: "Create and update tasks" },
  { value: "tasks:delete", label: "Delete Tasks", description: "Delete tasks" },
  { value: "journal:read", label: "Read Journal", description: "View journal entries" },
  { value: "journal:write", label: "Write Journal", description: "Create and update journal entries" },
  { value: "journal:delete", label: "Delete Journal", description: "Delete journal entries" },
  { value: "tags:read", label: "Read Tags", description: "View tags" },
  { value: "tags:write", label: "Write Tags", description: "Create and update tags" },
  { value: "tags:delete", label: "Delete Tags", description: "Delete tags" },
] as const;
