export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import Link from "next/link";
import { getJournal } from "@/lib/actions/journal";
import { PostForm, PostCard } from "@/components/features/post-form";
import { SliceOfLifeForm } from "@/components/features/slice-of-life-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Layers } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function JournalDetailPage({ params }: Props) {
  const { id } = await params;
  const journal = await getJournal(id);

  if (!journal) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/journal">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{journal.name}</h1>
          {journal.description && (
            <p className="text-muted-foreground">{journal.description}</p>
          )}
        </div>
        <PostForm journalId={journal.id} slices={journal.slices} />
      </div>

      <Tabs defaultValue="posts">
        <TabsList>
          <TabsTrigger value="posts" className="gap-2">
            <FileText className="h-4 w-4" />
            Posts ({journal.posts.length})
          </TabsTrigger>
          <TabsTrigger value="slices" className="gap-2">
            <Layers className="h-4 w-4" />
            Slices of Life ({journal.slices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-6">
          {journal.posts.length === 0 ? (
            <div className="text-center py-12 border rounded-lg">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No posts yet</h3>
              <p className="text-muted-foreground mb-4">
                Write your first entry
              </p>
              <PostForm journalId={journal.id} slices={journal.slices} />
            </div>
          ) : (
            <div className="space-y-4">
              {journal.posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={{
                    ...post,
                    writtenAt: new Date(post.writtenAt),
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="slices" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Slices of Life</CardTitle>
              <SliceOfLifeForm journalId={journal.id} />
            </CardHeader>
            <CardContent>
              {journal.slices.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No slices of life yet. Create themed periods to organize your posts.
                </p>
              ) : (
                <div className="space-y-3">
                  {journal.slices.map((slice) => (
                    <div
                      key={slice.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">{slice.name}</h4>
                        {slice.description && (
                          <p className="text-sm text-muted-foreground">
                            {slice.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {slice.startedAt
                            ? new Date(slice.startedAt).toLocaleDateString()
                            : "No start date"}{" "}
                          —{" "}
                          {slice.endedAt
                            ? new Date(slice.endedAt).toLocaleDateString()
                            : "Ongoing"}
                        </p>
                      </div>
                      <SliceOfLifeForm journalId={journal.id} slice={slice} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
