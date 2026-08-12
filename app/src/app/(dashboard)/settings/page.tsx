export const dynamic = 'force-dynamic';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell, Mail, MessageSquare, Settings, SmilePlus } from "lucide-react";
import { getNotificationChannels, getSentNotifications } from "@/lib/actions/notification-channels";
import { getContactInformationTypes, getAddressTypes } from "@/lib/actions/contact-info";
import { getCallReasons } from "@/lib/actions/calls";
import { getGiftOccasions } from "@/lib/actions/gifts";
import { getLifeEventCategories } from "@/lib/actions/life-events";
import { getPetCategories } from "@/lib/actions/pets";
import { getProfile } from "@/lib/actions/profile";
import { NotificationChannelForm } from "@/components/features/notification-channel-form";
import { NotificationChannelList } from "@/components/features/notification-channel-list";
import { ContactInfoTypeManager } from "@/components/features/contact-info-type-manager";
import { CallReasonManager } from "@/components/features/call-reason-manager";
import { GiftOccasionManager } from "@/components/features/gift-occasion-manager";
import { LifeEventCategoryManager } from "@/components/features/life-event-category-manager";
import { PetCategoryManager } from "@/components/features/pet-category-manager";
import { JournalMetricsManager } from "@/components/features/journal-metrics-manager";
import { CurrencyManager } from "@/components/features/currency-manager";
import { TemplateManager } from "@/components/features/template-manager";
import { ApiTokenManager } from "@/components/features/api-token-manager";
import { TagManager } from "@/components/features/tag-manager";
import { AuditLogViewer } from "@/components/features/audit-log-viewer";
import { ExportManager } from "@/components/features/export-manager";
import { ImportManager } from "@/components/features/import-manager";
import { MoodTrackingManager } from "@/components/features/mood-tracking-manager";
import { ProfileForm, PasswordForm, DangerZone } from "@/components/features/profile-form";
import { UserPreferencesManager } from "@/components/features/user-preferences-manager";
import { getUserPreferences } from "@/lib/actions/user-preferences";

export default async function SettingsPage() {
  const [
    channels,
    sentNotifications,
    contactInfoTypes,
    addressTypes,
    callReasons,
    giftOccasions,
    lifeEventCategories,
    petCategories,
    profile,
    userPreferences,
  ] = await Promise.all([
    getNotificationChannels(),
    getSentNotifications(10),
    getContactInformationTypes(),
    getAddressTypes(),
    getCallReasons(),
    getGiftOccasions(),
    getLifeEventCategories(),
    getPetCategories(),
    getProfile(),
    getUserPreferences(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your notification preferences and account settings.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Notification Channels */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Channels
            </CardTitle>
            <CardDescription>
              Set up how you want to receive reminders about important dates and events.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add new channel form */}
            <NotificationChannelForm />

            {/* Existing channels */}
            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                Your Notification Channels
              </h3>
              <NotificationChannelList channels={channels} />
            </div>
          </CardContent>
        </Card>

        {/* Recent Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Recent Notifications
            </CardTitle>
            <CardDescription>
              History of sent notifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sentNotifications.length > 0 ? (
              <div className="space-y-3">
                {sentNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="flex items-start justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {notification.channel.type === "email" ? (
                          <Mail className="h-4 w-4" />
                        ) : (
                          <MessageSquare className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{notification.subject}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          via {notification.channel.label}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(notification.sentAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                No notifications sent yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Profile Settings */}
        <ProfileForm profile={profile} />

        {/* Password Settings */}
        <PasswordForm />

        {/* Contact Information Types */}
        <div className="md:col-span-2">
          <ContactInfoTypeManager
            contactInfoTypes={contactInfoTypes}
            addressTypes={addressTypes}
          />
        </div>

        {/* Call Reasons */}
        <CallReasonManager initialReasonTypes={callReasons} />

        {/* Gift Occasions */}
        <GiftOccasionManager initialOccasions={giftOccasions} />

        {/* Life Event Categories */}
        <LifeEventCategoryManager initialCategories={lifeEventCategories} />

        {/* Pet Categories */}
        <PetCategoryManager initialCategories={petCategories} />

        {/* Journal Metrics */}
        <JournalMetricsManager />

        {/* Mood Tracking Parameters */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SmilePlus className="h-5 w-5" />
              Mood Tracking
            </CardTitle>
            <CardDescription>
              Configure mood levels for tracking how your contacts are feeling.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MoodTrackingManager />
          </CardContent>
        </Card>

        {/* User Preferences */}
        <UserPreferencesManager initialPreferences={userPreferences} />

        {/* Currencies */}
        <CurrencyManager />

        {/* Contact Page Templates */}
        <TemplateManager />

        {/* Tags */}
        <TagManager />

        {/* API Tokens */}
        <ApiTokenManager />

        {/* Activity Log */}
        <AuditLogViewer />

        {/* Export Data */}
        <ExportManager />

        {/* Import Data */}
        <ImportManager />

        {/* Danger Zone */}
        <DangerZone />
      </div>
    </div>
  );
}
