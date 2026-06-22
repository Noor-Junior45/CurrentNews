export interface Post {
  id: string;
  title: string;
  content: string; // HTML string from rich text editor
  youtubeUrl: string;
  facebookUrl: string;
  customLinks?: string[]; // Multiple additional social/custom embed links
  authorName?: string; // Optional user choice for editorial signature
  category?: string; // e.g. Politics, Tech, Sports, Opinion, Business, etc.
  createdAt: any; // Firestore Timestamp or Date representation
  updatedAt?: any; // Firestore Timestamp or Date representation
  status?: 'published' | 'draft'; // Publication status
  likes?: number; // Upvotes count
  dislikes?: number; // Downvotes count
  imageUrl?: string; // Opt to attach image/link
  imagePosition?: 'top' | 'middle' | 'bottom'; // Position mapping: top, middle, bottom
}
