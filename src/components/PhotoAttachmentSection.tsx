import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Loader2, 
  Trash2, 
  Plus, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { compressImage } from '../utils/imageCompressor';

interface PhotoAttachmentSectionProps {
  primaryImageUrl: string;
  onPrimaryImageUrlChange: (url: string) => void;
  galleryUrls: string[];
  onGalleryUrlsChange: (urls: string[]) => void;
  imagePosition: 'top' | 'middle' | 'bottom';
  onImagePositionChange: (pos: 'top' | 'middle' | 'bottom') => void;
  onInsertFigureIntoContent?: (figureTag: string) => void;
}

export default function PhotoAttachmentSection({
  primaryImageUrl,
  onPrimaryImageUrlChange,
  galleryUrls,
  onGalleryUrlsChange,
  imagePosition,
  onImagePositionChange,
  onInsertFigureIntoContent,
}: PhotoAttachmentSectionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // Core upload pipeline with client-side compression
  const processAndUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);

    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setError('Please select valid image files (JPG, PNG, WebP).');
      setIsUploading(false);
      return;
    }

    const uploadedUrls: string[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      try {
        const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        setStatusText(`Compressing photo ${i + 1}/${validFiles.length} (${originalSizeMB} MB)...`);

        // Compress in browser via HTML5 Canvas into ultra-fast WebP before uploading
        const compressedFile = await compressImage(file, 1920, 1080, 0.82);
        const compressedSizeKB = Math.round(compressedFile.size / 1024);

        setStatusText(`Uploading photo ${i + 1}/${validFiles.length} (${compressedSizeKB} KB)...`);

        const formData = new FormData();
        formData.append('image', compressedFile);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success || !data.url) {
          throw new Error(data.error || 'Upload error from server');
        }

        uploadedUrls.push(data.url);
      } catch (err: any) {
        console.error('Error uploading file:', err);
        setError(err.message || 'Failed to upload one or more images.');
      }
    }

    if (uploadedUrls.length > 0) {
      if (!primaryImageUrl) {
        // Set first as primary, remaining to gallery
        onPrimaryImageUrlChange(uploadedUrls[0]);
        if (uploadedUrls.length > 1) {
          onGalleryUrlsChange([...galleryUrls, ...uploadedUrls.slice(1)]);
        }
      } else {
        // If primary already exists, append all newly uploaded to gallery
        onGalleryUrlsChange([...galleryUrls, ...uploadedUrls]);
      }
    }

    setIsUploading(false);
    setStatusText('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processAndUploadFiles(e.dataTransfer.files);
    }
  };

  const hasPhotos = Boolean(primaryImageUrl) || galleryUrls.length > 0;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4" id="image-attachment-group">
      {/* 1. Header with logo and nothing else */}
      <div className="flex items-center space-x-2">
        <ImageIcon className="h-4 w-4 text-indigo-600" />
        <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider font-mono">
          Upload Photo
        </h3>
      </div>

      {/* 2. Drag & Drop / Click to browse box (Hidden once at least one photo is uploaded, Add Image button used thereafter) */}
      {!hasPhotos && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50'
              : 'border-slate-300 bg-white hover:bg-slate-50'
          } ${isUploading ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => e.target.files && processAndUploadFiles(e.target.files)}
            className="hidden"
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="py-2 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
              <span className="text-xs font-semibold text-slate-700 font-mono">
                {statusText || 'Uploading to Cloudflare R2...'}
              </span>
            </div>
          ) : (
            <div className="py-2 flex flex-col items-center justify-center space-y-2">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
                <UploadCloud className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-slate-700">
                Click to browse or drop an image file here
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error notification if any */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Previews in left side and in same line in right side photo flow placement */}
      {hasPhotos && (
        <div className="space-y-3 pt-1">
          {/* Primary Photo Row */}
          {primaryImageUrl && (
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Left Side: Thumbnail Preview */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-16 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                  <img
                    src={primaryImageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      <Check className="h-3 w-3" />
                      <span>Primary Photo</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onInsertFigureIntoContent && onInsertFigureIntoContent('[fig. 1]')}
                      className="text-[10px] font-mono font-bold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors"
                      title="Click to insert [fig. 1] into article body"
                    >
                      [fig. 1]
                    </button>
                  </div>
                  <span className="block text-[11px] font-mono text-slate-500 truncate max-w-[200px] sm:max-w-xs">
                    {primaryImageUrl}
                  </span>
                </div>
              </div>

              {/* Right Side in Same Line: Photo Flow Placement button & Delete */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase text-slate-500">
                    Photo Flow Placement:
                  </label>
                  <select
                    value={imagePosition}
                    onChange={(e) => onImagePositionChange(e.target.value as 'top' | 'middle' | 'bottom')}
                    className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                  >
                    <option value="top">Top of article</option>
                    <option value="middle">Middle</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    // Promote first gallery item to primary if available, otherwise clear
                    if (galleryUrls.length > 0) {
                      onPrimaryImageUrlChange(galleryUrls[0]);
                      onGalleryUrlsChange(galleryUrls.slice(1));
                    } else {
                      onPrimaryImageUrlChange('');
                    }
                  }}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Remove photo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Additional Photos (Gallery) Rows */}
          {galleryUrls.map((url, idx) => {
            const figNum = idx + 2;
            return (
              <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-16 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                    <img
                      src={url}
                      alt={`Photo ${figNum}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-mono font-bold uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        Photo #{figNum}
                      </span>
                      <button
                        type="button"
                        onClick={() => onInsertFigureIntoContent && onInsertFigureIntoContent(`[fig. ${figNum}]`)}
                        className="text-[10px] font-mono font-bold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors"
                        title={`Click to insert [fig. ${figNum}] into article body`}
                      >
                        [fig. {figNum}]
                      </button>
                    </div>
                    <span className="block text-[11px] font-mono text-slate-500 truncate max-w-[200px] sm:max-w-xs">
                      {url}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      // Swap this photo to be the primary photo
                      const oldPrimary = primaryImageUrl;
                      onPrimaryImageUrlChange(url);
                      const newGallery = [...galleryUrls];
                      if (oldPrimary) {
                        newGallery[idx] = oldPrimary;
                      } else {
                        newGallery.splice(idx, 1);
                      }
                      onGalleryUrlsChange(newGallery);
                    }}
                    className="text-[10px] font-mono font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg border border-indigo-200 transition-colors"
                  >
                    Make Primary
                  </button>
                  <button
                    type="button"
                    onClick={() => onGalleryUrlsChange(galleryUrls.filter((_, i) => i !== idx))}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Remove photo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Bottom "Add Image" button */}
          <div className="pt-1">
            <input
              ref={addMoreInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && processAndUploadFiles(e.target.files)}
              className="hidden"
              disabled={isUploading}
            />
            <button
              type="button"
              onClick={() => addMoreInputRef.current?.click()}
              disabled={isUploading}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="h-4 w-4 text-indigo-600" />
              <span>Add Image</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
