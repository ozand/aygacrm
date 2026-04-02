"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { GearIcon, GlobeIcon, MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { Bell } from "lucide-react";

// Placeholder for user preferences type
interface UserPreferences {
  language: string;
  theme: "light" | "dark" | "system";
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
  timezone: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

// Placeholder for saving preferences
async function saveUserPreferences(preferences: UserPreferences): Promise<boolean> {
  // Simulate API call
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("Saving preferences:", preferences);
      resolve(true);
    }, 1000);
  });
}

interface UserPreferencesManagerProps {
  initialPreferences: UserPreferences;
}

export function UserPreferencesManager({ initialPreferences }: UserPreferencesManagerProps) {
  const [preferences, setPreferences] = useState<UserPreferences>(initialPreferences);
  const [loading, setLoading] = useState(false);

  const handlePreferenceChange = (key: keyof UserPreferences, value: any) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const success = await saveUserPreferences(preferences);
      if (success) {
        toast.success("Preferences saved successfully!");
      } else {
        toast.error("Failed to save preferences.");
      }
    } catch (error) {
      toast.error("An error occurred while saving preferences.");
      console.error("Failed to save user preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GearIcon className="h-5 w-5" />
          User Preferences
        </CardTitle>
        <CardDescription>
          Customize your experience with language, theme, and notification settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Language */}
          <div>
            <Label htmlFor="language">Language</Label>
            <Select
              value={preferences.language}
              onValueChange={(value) => handlePreferenceChange("language", value)}
            >
              <SelectTrigger className="w-[180px]">
                <GlobeIcon className="mr-2" />
                <SelectValue placeholder="Select a language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Theme */}
          <div>
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={preferences.theme}
              onValueChange={(value) => handlePreferenceChange("theme", value)}
            >
              <SelectTrigger className="w-[180px]">
                {preferences.theme === "light" ? (
                  <SunIcon className="mr-2" />
                ) : preferences.theme === "dark" ? (
                  <MoonIcon className="mr-2" />
                ) : (
                  <GearIcon className="mr-2" />
                )}
                <SelectValue placeholder="Select a theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Format */}
          <div>
            <Label htmlFor="dateFormat">Date Format</Label>
            <Select
              value={preferences.dateFormat}
              onValueChange={(value) => handlePreferenceChange("dateFormat", value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select date format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Time Format */}
          <div>
            <Label htmlFor="timeFormat">Time Format</Label>
            <Select
              value={preferences.timeFormat}
              onValueChange={(value) => handlePreferenceChange("timeFormat", value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select time format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                <SelectItem value="24h">24-hour</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Number Format (Placeholder - more complex in real app) */}
          <div>
            <Label htmlFor="numberFormat">Number Format</Label>
            <Select
              value={preferences.numberFormat}
              onValueChange={(value) => handlePreferenceChange("numberFormat", value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select number format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1,234.56">1,234.56</SelectItem>
                <SelectItem value="1.234,56">1.234,56</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Timezone */}
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={preferences.timezone}
              onValueChange={(value) => handlePreferenceChange("timezone", value)}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">America/New_York</SelectItem>
                <SelectItem value="Europe/London">Europe/London</SelectItem>
                {/* Add more timezones as needed */}
              </SelectContent>
            </Select>
          </div>

          {/* Notification Settings */}
          <div>
            <h3 className="text-md font-semibold mb-2 flex items-center gap-2">
              <Bell className="h-4 w-4" /> Notifications
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="emailNotifications">Email Notifications</Label>
                <Switch
                  id="emailNotifications"
                  checked={preferences.emailNotifications}
                  onCheckedChange={(checked) => handlePreferenceChange("emailNotifications", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="pushNotifications">Push Notifications</Label>
                <Switch
                  id="pushNotifications"
                  checked={preferences.pushNotifications}
                  onCheckedChange={(checked) => handlePreferenceChange("pushNotifications", checked)}
                />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Preferences"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
