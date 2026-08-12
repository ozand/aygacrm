export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Edit,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  Calendar,
  FileText,
  Cake,
  Tag,
  Bell,
  Users,
  CheckSquare,
  Sparkles,
  PawPrint,
  Gift,
  Banknote,
  Target,
  Milestone,
  Activity,
  Paperclip,
  FolderOpen,
  Link2,
} from "lucide-react";
import { getContact } from "@/lib/actions/contacts";
import { getNotesForContact } from "@/lib/actions/notes";
import { getImportantDatesForContact } from "@/lib/actions/important-dates";
import { getLabels } from "@/lib/actions/labels";
import { getRemindersForContact } from "@/lib/actions/reminders";
import {
  getRelationshipsForContact,
  getRelationshipTypes,
  getContactsForRelationshipPicker,
} from "@/lib/actions/relationships";
import { getTasksForContact } from "@/lib/actions/tasks";
import { getCallsForContact, getCallReasons } from "@/lib/actions/calls";
import { getContactAvatar, getContactPhotos } from "@/lib/actions/avatar";
import { getQuickFactsForContact } from "@/lib/actions/quick-facts";
import { getPetsForContact, getPetCategories } from "@/lib/actions/pets";
import { getGiftsForContact, getGiftOccasions } from "@/lib/actions/gifts";
import { getLoansForContact } from "@/lib/actions/loans";
import { getGoalsForContact } from "@/lib/actions/goals";
import { getLifeEventsForContact, getLifeEventCategories } from "@/lib/actions/life-events";
import { getActivitiesForContact } from "@/lib/actions/activities";
import { getDocumentsForContact } from "@/lib/actions/documents";
import { getGroupsForContact } from "@/lib/actions/groups";
import { getContactInformationTypes, getContactInformationForContact } from "@/lib/actions/contact-info";
import { getAddressesForContact, getAddressTypes, ensureDefaultAddressTypes } from "@/lib/actions/addresses";
import { ensureDefaultGenders, ensureDefaultPronouns } from "@/lib/actions/gender-pronoun";
import { ensureDefaultReligions } from "@/lib/actions/religion";
import { ensureDefaultEmotions } from "@/lib/actions/emotions";
import { NoteForm } from "@/components/features/note-form";
import { NotesList } from "@/components/features/notes-list";
import { ImportantDateForm } from "@/components/features/important-date-form";
import { ContactLabels } from "@/components/features/contact-labels";
import { ReminderForm } from "@/components/features/reminder-form";
import { RelationshipForm } from "@/components/features/relationship-form";
import { TaskForm } from "@/components/features/task-form";
import { CallForm } from "@/components/features/call-form";
import { AvatarUpload } from "@/components/features/avatar-upload";
import { QuickFactForm } from "@/components/features/quick-fact-form";
import { PetForm } from "@/components/features/pet-form";
import { GiftForm } from "@/components/features/gift-form";
import { LoanForm } from "@/components/features/loan-form";
import { GoalForm } from "@/components/features/goal-form";
import { LifeEventForm } from "@/components/features/life-event-form";
import { ActivityForm } from "@/components/features/activity-form";
import { DocumentForm } from "@/components/features/document-form";
import { ContactGroupForm } from "@/components/features/contact-group-form";
import { ContactInfoForm } from "@/components/features/contact-info-form";
import { AddressForm } from "@/components/features/address-form";
import { GenderPronounForm } from "@/components/features/gender-pronoun-form";
import { ReligionForm } from "@/components/features/religion-form";
import { MoodTrackingForm } from "@/components/features/mood-tracking-form";
import { ContactFeed } from "@/components/features/contact-feed";
import { ExternalIdentityForm } from "@/components/features/external-identity-form";
import { getExternalIdentitiesForContact } from "@/lib/actions/external-identities";
import { getExternalRecordsForContact } from "@/lib/actions/external-records";
import { ExternalRecordsCard } from "@/components/features/external-records-card";

interface ContactDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({
  params,
}: ContactDetailPageProps) {
  const { id } = await params;
  const contact = await getContact(id);

  if (!contact) {
    notFound();
  }

  const notes = await getNotesForContact(id);
  const importantDates = await getImportantDatesForContact(id);
  const allLabels = await getLabels();
  const reminders = await getRemindersForContact(id);
  const relationships = await getRelationshipsForContact(id);
  const relationshipTypes = await getRelationshipTypes();
  const contactsForPicker = await getContactsForRelationshipPicker(id);
  const tasks = await getTasksForContact(id);
  const calls = await getCallsForContact(id);
  const callReasonTypes = await getCallReasons();
  const avatar = await getContactAvatar(id);
  const photos = await getContactPhotos(id);
  const quickFacts = await getQuickFactsForContact(id);
  const pets = await getPetsForContact(id);
  const petCategories = await getPetCategories();
  const gifts = await getGiftsForContact(id);
  const giftOccasions = await getGiftOccasions();
  const loans = await getLoansForContact(id);
  const goals = await getGoalsForContact(id);
  const lifeEvents = await getLifeEventsForContact(id);
  const lifeEventCategories = await getLifeEventCategories();
  const activities = await getActivitiesForContact(id);
  const documents = await getDocumentsForContact(id);
  const { groups, contactGroups } = await getGroupsForContact(id);
  const contactInfoTypes = await getContactInformationTypes();
  const contactInfoData = await getContactInformationForContact(id);
  const addressTypes = await ensureDefaultAddressTypes();
  const addresses = await getAddressesForContact(id);
  const genders = await ensureDefaultGenders();
  const pronouns = await ensureDefaultPronouns();
  const religions = await ensureDefaultReligions();
  const emotions = await ensureDefaultEmotions();
  const externalIdentities = await getExternalIdentitiesForContact(id);
  const externalRecords = await getExternalRecordsForContact(id);

  // Build display name
  const displayName =
    [contact.prefix, contact.firstName, contact.middleName, contact.lastName, contact.suffix]
      .filter(Boolean)
      .join(" ") ||
    contact.nickname ||
    "Unnamed Contact";

  // Get initials for avatar
  const initials = [contact.firstName?.[0], contact.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "?";

  // Format date helper
  const formatDate = (month: number | null, day: number | null, year: number | null) => {
    const parts = [];
    if (month && day) {
      const date = new Date(2000, month - 1, day);
      parts.push(date.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    }
    if (year) {
      parts.push(year.toString());
    }
    return parts.join(", ") || "Unknown date";
  };

  // Calculate age for birthdays
  const calculateAge = (year: number | null) => {
    if (!year) return null;
    const today = new Date();
    return today.getFullYear() - year;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/contacts" aria-label="Back to contacts">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-4">
            <AvatarUpload
              contactId={contact.id}
              currentAvatar={avatar}
              photos={photos}
              initials={initials}
              displayName={displayName}
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {displayName}
              </h1>
              {contact.jobPosition && (
                <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  {contact.jobPosition}
                  {contact.company && (
                    <>
                      {" at "}
                      <span className="font-medium">{contact.company.name}</span>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
        <Button asChild>
          <Link href={`/contacts/${contact.id}/edit`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contact Information
              {contactInfoData.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({contactInfoData.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ContactInfoForm
              contactId={contact.id}
              infoTypes={contactInfoTypes}
              existingInfo={contactInfoData}
            />
          </CardContent>
        </Card>

        {/* External Identities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              External Identities
              {externalIdentities.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({externalIdentities.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExternalIdentityForm
              contactId={contact.id}
              existingIdentities={externalIdentities}
            />
          </CardContent>
        </Card>

        {/* External Records */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              External Records
              {externalRecords.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({externalRecords.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExternalRecordsCard contactId={contact.id} existingRecords={externalRecords} />
          </CardContent>
        </Card>

        {/* Gender & Pronouns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gender & Pronouns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GenderPronounForm
              contactId={contact.id}
              genders={genders}
              pronouns={pronouns}
              currentGenderId={contact.genderId}
              currentPronounId={contact.pronounId}
              currentGenderName={contact.gender?.name || null}
              currentPronounName={contact.pronoun?.name || null}
            />
          </CardContent>
        </Card>

        {/* Religion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Religion / Beliefs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReligionForm
              contactId={contact.id}
              religions={religions}
              currentReligionId={contact.religionId}
              currentReligionName={contact.religion?.name || null}
            />
          </CardContent>
        </Card>

        {/* Mood Tracking */}
        <MoodTrackingForm contactId={contact.id} />

        {/* Addresses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Addresses
              {addresses.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({addresses.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AddressForm
              contactId={contact.id}
              addressTypes={addressTypes}
              existingAddresses={addresses}
            />
          </CardContent>
        </Card>

        {/* Important Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="h-5 w-5" />
              Important Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {importantDates && importantDates.length > 0 ? (
              <div className="space-y-3">
                {importantDates.map((date) => {
                  const age = calculateAge(date.year);
                  return (
                    <div
                      key={date.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {date.label || date.type?.name || "Important Date"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(date.month, date.day, date.year)}
                            {age && ` (${age} years old)`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm italic mb-4">
                No important dates added yet.
              </p>
            )}
            <ImportantDateForm contactId={contact.id} />
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes
              {notes.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({notes.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <NoteForm contactId={contact.id} emotions={emotions} />
            <NotesList notes={notes} />
          </CardContent>
        </Card>

        {/* Labels */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Labels
              {contact.labels.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({contact.labels.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ContactLabels
              contactId={contact.id}
              currentLabels={contact.labels}
              availableLabels={allLabels}
            />
          </CardContent>
        </Card>

        {/* Groups */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Groups
              {contactGroups.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({contactGroups.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ContactGroupForm
              contactId={contact.id}
              groups={groups}
              contactGroups={contactGroups}
            />
          </CardContent>
        </Card>

        {/* Reminders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Reminders
              {reminders.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({reminders.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReminderForm
              contactId={contact.id}
              importantDates={importantDates}
              existingReminders={reminders}
            />
          </CardContent>
        </Card>

        {/* Relationships */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Relationships
              {relationships.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({relationships.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RelationshipForm
              contactId={contact.id}
              contacts={contactsForPicker}
              relationshipTypes={relationshipTypes}
              existingRelationships={relationships}
            />
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Tasks
              {tasks.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({tasks.filter((t) => !t.completed).length} pending)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TaskForm contactId={contact.id} existingTasks={tasks} />
          </CardContent>
        </Card>

        {/* Calls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Calls
              {calls.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({calls.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CallForm
              contactId={contact.id}
              callReasonTypes={callReasonTypes}
              existingCalls={calls}
            />
          </CardContent>
        </Card>

        {/* Quick Facts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Quick Facts
              {quickFacts.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({quickFacts.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <QuickFactForm contactId={contact.id} existingFacts={quickFacts} />
          </CardContent>
        </Card>

        {/* Pets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PawPrint className="h-5 w-5" />
              Pets
              {pets.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({pets.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PetForm
              contactId={contact.id}
              categories={petCategories}
              existingPets={pets}
            />
          </CardContent>
        </Card>

        {/* Gifts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Gifts
              {gifts.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({gifts.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GiftForm
              contactId={contact.id}
              occasions={giftOccasions}
              existingGifts={gifts}
            />
          </CardContent>
        </Card>

        {/* Loans */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Loans & Debts
              {loans.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({loans.filter((l) => !l.settledAt).length} active)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LoanForm contactId={contact.id} existingLoans={loans} />
          </CardContent>
        </Card>

        {/* Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Goals
              {goals.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({goals.filter((g) => g.active).length} active)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GoalForm contactId={contact.id} existingGoals={goals} />
          </CardContent>
        </Card>

        {/* Life Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Milestone className="h-5 w-5" />
              Life Events
              {lifeEvents.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({lifeEvents.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LifeEventForm
              contactId={contact.id}
              categories={lifeEventCategories}
              existingEvents={lifeEvents}
            />
          </CardContent>
        </Card>

        {/* Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activities
              {activities.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({activities.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityForm
              contactId={contact.id}
              existingActivities={activities}
            />
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Documents
              {documents.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({documents.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentForm
              contactId={contact.id}
              existingDocuments={documents}
            />
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <ContactFeed contactId={contact.id} />
    </div>
  );
}
