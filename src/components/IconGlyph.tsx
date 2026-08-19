import {
  Archive,
  Atom,
  Bookmark,
  Boxes,
  Folder,
  Heart,
  Inbox,
  Lock,
  LucideIcon,
  Plane,
  Search,
  Settings,
  Sparkles,
  Star
} from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  Archive,
  Atom,
  Bookmark,
  Boxes,
  Folder,
  Heart,
  Inbox,
  Lock,
  Plane,
  Search,
  Settings,
  Sparkles,
  Star
};

interface IconGlyphProps {
  name?: string;
  className?: string;
}

export function IconGlyph({ name = 'Folder', className }: IconGlyphProps) {
  const Icon = icons[name] ?? Folder;
  return <Icon className={className} aria-hidden />;
}
