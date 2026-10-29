export type StorefrontBlockType =
  | "announcement_marquee"
  | "hero_slider"
  | "category_bubbles"
  | "flash_sale"
  | "featured_rails"
  | "product_reels"
  | "catalog_grid"
  | "trust_badges"
  | "testimonials"
  | "brand_story"
  | "faq_accordion";

// 0. Catalog Grid Anchor Config
export interface CatalogGridConfig {
  title?: string;
}

// 1. Ticker / Marquesina
export interface AnnouncementMarqueeConfig {
  messages: string[];
  speedSeconds: number; // e.g. 25s
  bgVariant: "primary" | "dark" | "amber" | "muted";
  iconName?: "Sparkles" | "Zap" | "Truck" | "Tag" | "ShieldCheck";
}

// 2. Hero Slider
export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  mobileImageUrl?: string;
  ctaText?: string;
  ctaLink?: string; // e.g. "category:promociones", "product:prod_123", "whatsapp"
  badgeText?: string;
  textAlignment: "left" | "center" | "right";
  overlayOpacity: number; // 0 to 80%
}

export interface HeroSliderConfig {
  slides: HeroSlide[];
  autoplayIntervalMs: number; // 0 = disabled, 4000 = 4s
  aspectRatio: "16:9" | "21:9" | "4:3";
}

// 3. Category Bubbles / Stories
export interface CategoryBubbleItem {
  id: string;
  categoryId: string;
  customLabel?: string;
  imageUrl?: string;
  isHighlight?: boolean;
}

export interface CategoryBubblesConfig {
  useAutoCategories: boolean; // If true, pulls from tenant categories
  customItems?: CategoryBubbleItem[];
  showLabels: boolean;
  bubbleShape: "circle" | "squircle";
}

// 4. Flash Sale Timer
export interface FlashSaleConfig {
  title: string;
  subtitle: string;
  endsAt: string; // ISO 8601 string
  accentColor?: string;
  bannerBgGradient?: string;
  targetCategoryId?: string;
  discountBadgeText?: string; // e.g. "HASTA 40% OFF"
}

// 5. Featured Rails (Showcases)
export interface FeaturedRailItem {
  id: string;
  title: string;
  subtitle?: string;
  filterType: "bestsellers" | "on_sale" | "category" | "custom";
  categoryId?: string;
  customProductIds?: string[];
  maxItems: number;
}

export interface FeaturedRailsConfig {
  rails: FeaturedRailItem[];
}

// 6. Product Reels (Short Videos)
export interface ProductReelItem {
  id: string;
  title: string;
  videoUrl: string;
  posterUrl?: string;
  productId?: string;
  badge?: string;
}

export interface ProductReelsConfig {
  reels: ProductReelItem[];
  autoplayOnHover: boolean;
}

// 7. Trust Badges
export interface TrustBadgeItem {
  id: string;
  icon: "Truck" | "ShieldCheck" | "Clock" | "CreditCard" | "RefreshCw" | "MessageCircle" | "Award";
  title: string;
  description: string;
}

export interface TrustBadgesConfig {
  badges: TrustBadgeItem[];
  columns: 2 | 3 | 4;
}

// 8. Testimonials / Social Proof
export interface TestimonialItem {
  id: string;
  authorName: string;
  authorLocation?: string; // e.g. "Barquisimeto Este"
  avatarUrl?: string;
  rating: number; // 1 to 5
  comment: string;
  verifiedBuyer: boolean;
  dateText?: string; // e.g. "Hace 2 días"
}

export interface TestimonialsConfig {
  title: string;
  subtitle?: string;
  items: TestimonialItem[];
}

// 9. Brand Story / Physical Presence
export interface BrandStoryConfig {
  title: string;
  subtitle?: string;
  storyContent: string;
  imageUrl: string;
  businessHours?: string;
  googleMapsUrl?: string;
  showBranchAddress: boolean;
}

// 10. FAQ Accordion
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqAccordionConfig {
  title: string;
  subtitle?: string;
  items: FaqItem[];
}

// Generic Block Container
export type BlockConfigMap = {
  announcement_marquee: AnnouncementMarqueeConfig;
  hero_slider: HeroSliderConfig;
  category_bubbles: CategoryBubblesConfig;
  flash_sale: FlashSaleConfig;
  featured_rails: FeaturedRailsConfig;
  product_reels: ProductReelsConfig;
  catalog_grid: CatalogGridConfig;
  trust_badges: TrustBadgesConfig;
  testimonials: TestimonialsConfig;
  brand_story: BrandStoryConfig;
  faq_accordion: FaqAccordionConfig;
};

export interface StorefrontBlock<T extends StorefrontBlockType = StorefrontBlockType> {
  id: string;
  type: T;
  label: string;
  enabled: boolean;
  order: number;
  config: BlockConfigMap[T];
}

export type StorefrontCatalogDensity = "compact" | "comfortable" | "list";

export interface StorefrontConfig {
  version: "1.0.0";
  catalogDensity: StorefrontCatalogDensity;
  containerWidth: "standard" | "wide" | "compact";
  blocks: StorefrontBlock[];
}
