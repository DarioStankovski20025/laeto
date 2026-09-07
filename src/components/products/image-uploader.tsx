"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, imageFileSchema } from "@/lib/validation/schemas";
import { formatFileSize } from "@/lib/utils/format";

interface ImageUploaderProps {
  userId: string;
  productId: string;
  /** Existing signed URL to preview, if the product already has an image. */
  existingImageUrl?: string | null;
  /** Called with the newly uploaded object's storage path, or null if cleared. */
  onChange: (path: string | null) => void;
}

/**
 * Uploads browser-direct to the private product-images bucket rather than
 * through a Server Action: Next's Server Action body limit defaults to 1MB,
 * far below a typical product photo, and Storage RLS already restricts
 * writes to this user's own {user_id}/ prefix, so nothing is lost by
 * skipping the server round-trip for the bytes themselves.
 */
export function ImageUploader({ userId, productId, existingImageUrl, onChange }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(existingImageUrl ?? null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(file: File) {
    setError(null);
    const validation = imageFileSchema.safeParse(file);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Invalid image.");
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setPreview(localPreviewUrl);
    setIsUploading(true);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/${productId}/${crypto.randomUUID()}.${extension}`;
      const supabase = createBrowserSupabase();
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });

      if (uploadError) {
        setError("Upload failed. Please try again.");
        toast.error("Image upload failed.");
        return;
      }

      onChange(path);
    } finally {
      setIsUploading(false);
    }
  }

  function handleClear() {
    setPreview(null);
    setError(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-muted">
          {preview ? (
            <Image src={preview} alt="Product preview" fill unoptimized className="object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="hidden"
            id="product-image-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileSelect(file);
            }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={isUploading}>
              {preview ? "Replace image" : "Upload image"}
            </Button>
            {preview && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={isUploading}>
                <X className="h-4 w-4" /> Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            JPG, PNG or WebP, up to {formatFileSize(MAX_IMAGE_BYTES)}.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
