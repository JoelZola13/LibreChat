export type GalleryImage = {
  url: string;
  caption?: string;
  credit?: string;
  layout_hint?: "full" | "wide" | "pair";
};

export type Article = {
  id: string;
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  author?: string;
  author_name?: string;
  category?: string;
  categories?: string[];
  tags?: string[];
  image_url?: string;
  feature_image_url?: string;
  read_time?: string;
  published_at?: string;
  status?: string;
  is_featured?: boolean;
  is_breaking?: boolean;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  gallery_images?: GalleryImage[];
  source_type?: "internal" | "aggregated";
  source_name?: string;
  source_url?: string;
};

export type Comment = {
  id: string;
  article_id: string;
  user_id: string;
  user_name?: string;
  content: string;
  created_at?: string;
};

export type SectionId = "all" | "street-voices" | "local" | "national" | "international";
