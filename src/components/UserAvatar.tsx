import React, { useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Trash2 } from 'lucide-react';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  editable?: boolean;
  onAvatarChange?: (newUrl: string | null) => void;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24'
};

export function UserAvatar({ 
  src, 
  alt = 'Avatar', 
  fallback = 'U', 
  size = 'md', 
  editable = false,
  onAvatarChange,
  className 
}: UserAvatarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadAvatar, deleteAvatar, uploading } = useAvatarUpload();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const newUrl = await uploadAvatar(file);
    if (newUrl && onAvatarChange) {
      onAvatarChange(newUrl);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    const success = await deleteAvatar();
    if (success && onAvatarChange) {
      onAvatarChange(null);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="relative group">
      <Avatar className={cn(sizeClasses[size], className)} showFrame={true}>
        <AvatarImage src={src || undefined} alt={alt} />
        <AvatarFallback className="bg-primary text-primary-foreground">
          {fallback}
        </AvatarFallback>
      </Avatar>

      {editable && (
        <>
          {/* Upload overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center">
            <div className="flex space-x-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleUploadClick}
                disabled={uploading}
                className="h-6 w-6 p-0 hover:bg-white/20"
              >
                <Camera className="w-3 h-3 text-white" />
              </Button>
              {src && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={uploading}
                  className="h-6 w-6 p-0 hover:bg-white/20"
                >
                  <Trash2 className="w-3 h-3 text-white" />
                </Button>
              )}
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </>
      )}

      {uploading && (
        <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}