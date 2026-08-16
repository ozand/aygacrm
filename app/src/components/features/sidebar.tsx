"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users,
  LayoutDashboard,
  BookOpen,
  Settings,
  Building2,
  Calendar,
  FileText,
  Tags,
  FolderOpen,
  Github,
} from "lucide-react";
import { GlobalSearch } from "@/components/features/global-search";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Groups", href: "/groups", icon: FolderOpen },
  { name: "Journal", href: "/journal", icon: BookOpen },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "Files", href: "/files", icon: FileText },
  { name: "Labels", href: "/labels", icon: Tags },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <Link href="/dashboard" className="text-2xl font-bold text-primary">
              AygaCRM
            </Link>
          </div>
          <div className="mb-4">
            <GlobalSearch />
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            "group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold",
                            isActive
                              ? "bg-gray-100 dark:bg-gray-800 text-primary"
                              : "text-gray-700 dark:text-gray-300 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-800"
                          )}
                        >
                          <item.icon
                            className={cn(
                              "h-6 w-6 shrink-0",
                              isActive
                                ? "text-primary"
                                : "text-gray-400 group-hover:text-primary"
                            )}
                            aria-hidden="true"
                          />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            </ul>
          </nav>
          {/*
            AGPL-3.0 §13: this is network-accessible software, so users
            interacting with it over a network must be offered its source.
            Derivative of Monica (github.com/monicahq/monica), AGPL-3.0-or-later.
          */}
          <a
            href="https://github.com/ozand/aygacrm"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-x-2 text-xs text-gray-400 hover:text-primary"
          >
            <Github className="h-4 w-4 shrink-0" aria-hidden="true" />
            Source code · AGPL-3.0
          </a>
        </div>
      </div>
    </>
  );
}
