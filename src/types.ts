export interface Post {
  id: string;
  title: string;
  content: string; // HTML string from rich text editor
  youtubeUrl: string;
  facebookUrl: string;
  customLinks?: string[]; // Multiple additional social/custom embed links
  authorName?: string; // Optional user choice for editorial signature
  authorEmail?: string; // Unique admin email identifier
  authorId?: string; // Unique admin UID identifier
  category?: string; // e.g. Politics, Tech, Sports, Opinion, Business, etc.
  createdAt: any; // Firestore Timestamp or Date representation
  updatedAt?: any; // Firestore Timestamp or Date representation
  status?: 'published' | 'draft'; // Publication status
  likes?: number; // Upvotes count
  dislikes?: number; // Downvotes count
  imageUrl?: string; // Opt to attach image/link
  imageUrls?: string[]; // Multiple extra image links
  imagePosition?: 'top' | 'middle' | 'bottom'; // Position mapping: top, middle, bottom
  views?: number; // Total article views
  hashtags?: string[]; // Custom social/instagram hashtags
}

export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}
