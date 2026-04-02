"use client";

import { useState, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Camera,
  Upload,
  Trash2,
  Loader2,
  ImageIcon,
  Star,
} from "lucide-react";
import { deletePhoto, setAvatarFromPhoto } from "@/lib/actions/avatar";
import { useRouter } from "next/navigation";

interface FileRecord {
  id: string;
  name: string;
  originalUrl: string;
  type: string;
}

interface AvatarUploadProps {
  contactId: string;
  currentAvatar: FileRecord | null;
  photos: FileRecord[];
  initials: string;
  displayName: string;
}

export function AvatarUpload({
  contactId,
  currentAvatar,
  photos,
  initials,
  displayName,
}: AvatarUploadProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("contactId", contactId);
      formData.append("type", "avatar");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Upload failed");
        return;
      }

      router.refresh();
      setIsDialogOpen(false);
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSetAsAvatar = (fileId: string) => {
    startTransition(async () => {
      const result = await setAvatarFromPhoto(contactId, fileId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || "Failed to set avatar");
      }
    });
  };

  const handleDelete = (fileId: string) => {
    if (!confirm("Are you sure you want to delete this photo?")) return;

    startTransition(async () => {
      const result = await deletePhoto(fileId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || "Failed to delete photo");
      }
    });
  };

  const allPhotos = photos.filter((p) => p.id !== currentAvatar?.id);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <button className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-2xl overflow-hidden hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all">
          {currentAvatar ? (
            <Avatar className="h-16 w-16">
              <AvatarImage src={currentAvatar.originalUrl} alt={displayName} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          ) : (
            <span>{initials}</span>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-6 w-6 text-white" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile Photo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Avatar Preview */}
          <div className="flex justify-center">
            <div className="relative">
              {currentAvatar ? (
                <Avatar className="h-32 w-32">
                  <AvatarImage
                    src={currentAvatar.originalUrl}
                    alt={displayName}
                  />
                  <AvatarFallback className="text-4xl">{initials}</AvatarFallback>
                </Avatar>
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-4xl">
                  {initials}
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">
              {error}
            </p>
          )}

          {/* Upload Button */}
          <div className="flex justify-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isPending}
              className="gap-2"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {isUploading ? "Uploading..." : "Upload New Photo"}
            </Button>
          </div>

          {/* Photo Gallery */}
          {allPhotos.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Other Photos ({allPhotos.length})
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {allPhotos.map((photo) => (
                  <div key={photo.id} className="group relative aspect-square">
                    <img
                      src={photo.originalUrl}
                      alt={photo.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-white hover:text-white hover:bg-white/20"
                        onClick={() => handleSetAsAvatar(photo.id)}
                        disabled={isPending}
                        title="Set as avatar"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-white hover:text-red-400 hover:bg-white/20"
                        onClick={() => handleDelete(photo.id)}
                        disabled={isPending}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delete Current Avatar */}
          {currentAvatar && (
            <div className="flex justify-center pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDelete(currentAvatar.id)}
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Current Photo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
