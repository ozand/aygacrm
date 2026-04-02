"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, GitMerge, Loader2, UserX } from "lucide-react";
import { toast } from "sonner";
import { findDuplicateCandidates, dismissDuplicate } from "@/lib/actions/duplicates";
import { mergeContacts } from "@/lib/actions/merge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DuplicateCandidate = Awaited<ReturnType<typeof findDuplicateCandidates>>[number];
type CandidateContact = DuplicateCandidate["contactA"];

interface PendingMerge {
  candidate: DuplicateCandidate;
  primary: CandidateContact;
  secondary: CandidateContact;
}

const reasonLabels: Record<string, string> = {
  external_identity_exact: "External identity matches",
  email_match: "Email matches",
  phone_match: "Phone matches",
  name_exact: "Exact name match",
  name_similar_lastname_prefix: "Similar last name",
  name_reversed: "First/last appears reversed",
};

function formatContactName(contact: CandidateContact): string {
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  if (contact.nickname?.trim()) {
    return contact.nickname.trim();
  }

  return "Unnamed contact";
}

function getScoreBadgeClass(score: number): string {
  if (score >= 80) {
    return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
  }

  if (score >= 60) {
    return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
  }

  return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
}

export function MergeQueue() {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingMerge, setPendingMerge] = useState<PendingMerge | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadCandidates() {
      setIsLoading(true);
      try {
        const result = await findDuplicateCandidates();
        if (mounted) {
          setCandidates(result);
        }
      } catch {
        toast.error("Failed to check for duplicate contacts.");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCandidates();

    return () => {
      mounted = false;
    };
  }, []);

  const isActionPending = useMemo(() => activeActionKey !== null, [activeActionKey]);

  const removeCandidate = (candidate: DuplicateCandidate) => {
    setCandidates((previous) =>
      previous.filter(
        (item) =>
          !(item.contactA.id === candidate.contactA.id && item.contactB.id === candidate.contactB.id)
      )
    );
  };

  const openMergeDialog = (candidate: DuplicateCandidate, primary: CandidateContact, secondary: CandidateContact) => {
    setPendingMerge({ candidate, primary, secondary });
    setIsDialogOpen(true);
  };

  const handleConfirmMerge = async () => {
    if (!pendingMerge) {
      return;
    }

    const actionKey = `merge:${pendingMerge.primary.id}:${pendingMerge.secondary.id}`;
    setActiveActionKey(actionKey);

    try {
      const result = await mergeContacts(pendingMerge.primary.id, pendingMerge.secondary.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to merge contacts.");
        return;
      }

      toast.success("Contacts merged successfully.");
      removeCandidate(pendingMerge.candidate);
      setIsDialogOpen(false);
      setPendingMerge(null);
    } catch {
      toast.error("Failed to merge contacts.");
    } finally {
      setActiveActionKey(null);
    }
  };

  const handleDismiss = async (candidate: DuplicateCandidate) => {
    const actionKey = `dismiss:${candidate.contactA.id}:${candidate.contactB.id}`;
    setActiveActionKey(actionKey);

    try {
      const result = await dismissDuplicate(candidate.contactA.id, candidate.contactB.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to dismiss duplicate candidate.");
        return;
      }

      removeCandidate(candidate);
      toast.success("Marked as not a duplicate.");
    } catch {
      toast.error("Failed to dismiss duplicate candidate.");
    } finally {
      setActiveActionKey(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Checking for duplicates...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (candidates.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No duplicate contacts found.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {candidates.map((candidate) => {
          const actionBase = `${candidate.contactA.id}:${candidate.contactB.id}`;
          const isMergingAToB = activeActionKey === `merge:${candidate.contactA.id}:${candidate.contactB.id}`;
          const isMergingBToA = activeActionKey === `merge:${candidate.contactB.id}:${candidate.contactA.id}`;
          const isDismissing = activeActionKey === `dismiss:${actionBase}`;

          return (
            <Card key={actionBase}>
              <CardContent className="space-y-3 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3">
                    <div className="font-medium">A: {formatContactName(candidate.contactA)}</div>
                    <div className="text-muted-foreground">vs</div>
                    <div className="font-medium">B: {formatContactName(candidate.contactB)}</div>
                  </div>
                  <Badge className={getScoreBadgeClass(candidate.score)}>Score {candidate.score}</Badge>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {candidate.matchReasons.map((reason) => (
                    <Badge key={reason} variant="outline" className="text-xs font-normal">
                      {reasonLabels[reason] ?? reason.replaceAll("_", " ")}
                    </Badge>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => openMergeDialog(candidate, candidate.contactA, candidate.contactB)}
                    disabled={isActionPending}
                  >
                    {isMergingAToB ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitMerge className="mr-2 h-4 w-4" />}
                    Merge A → B
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openMergeDialog(candidate, candidate.contactB, candidate.contactA)}
                    disabled={isActionPending}
                  >
                    {isMergingBToA ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitMerge className="mr-2 h-4 w-4" />}
                    Merge B → A
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDismiss(candidate)}
                    disabled={isActionPending}
                  >
                    {isDismissing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
                    Not a Duplicate
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setPendingMerge(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm merge</DialogTitle>
            <DialogDescription>
              This merges the secondary contact into the primary contact and keeps the primary record.
            </DialogDescription>
          </DialogHeader>

          {pendingMerge && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
              <div>
                <span className="text-muted-foreground">Primary (kept): </span>
                <span className="font-medium">{formatContactName(pendingMerge.primary)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Secondary (merged): </span>
                <span className="font-medium">{formatContactName(pendingMerge.secondary)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isActionPending}>
              Cancel
            </Button>
            <Button onClick={() => void handleConfirmMerge()} disabled={!pendingMerge || isActionPending}>
              {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Confirm Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
