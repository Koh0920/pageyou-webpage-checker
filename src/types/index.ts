export interface BusinessInfo {
  url: string;
  businessName?: string;
  industry?: string;
  location?: string;
}

export interface AnalysisResult {
  url: string;
  businessInfo: BusinessInfo;
  scores: {
    total: number;
    performance: number;
    mobile: number;
    seo: number;
    conversion: number;
    content: number;
  };
  issues: Issue[];
  opportunities: Opportunity[];
  estimatedMonthlyLoss: number;
  recommendedPlan: "Simple" | "Standard" | "Premium";
  priority: "High" | "Medium" | "Low";
  screenshots: {
    desktop: string;
    mobile: string;
  };
  analyzedAt: Date;
}

export interface Issue {
  category: "Performance" | "SEO" | "Mobile" | "Conversion" | "Content";
  severity: "Critical" | "High" | "Medium" | "Low";
  description: string;
  impact: string;
  solution: string;
}

export interface Opportunity {
  title: string;
  description: string;
  estimatedImprovement: number; // パーセンテージ
  estimatedRevenueLift: number; // 円
  effort: "Low" | "Medium" | "High";
  priority: number; // 1-10
}

export interface PageSpeedResult {
  score: number;
  metrics: {
    lcp: number; // Largest Contentful Paint (seconds)
    cls: number; // Cumulative Layout Shift
    fid: number; // First Input Delay (milliseconds)
    ttfb: number; // Time to First Byte (seconds)
    fcp: number; // First Contentful Paint (seconds)
    tbt: number; // Total Blocking Time (milliseconds)
  };
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    scoreImpact: number;
    displayValue?: string;
  }>;
}

export interface SEOCheckResult {
  hasTitle: boolean;
  titleLength: number;
  titleContent?: string;
  hasMetaDescription: boolean;
  metaDescriptionLength: number;
  metaDescriptionContent?: string;
  hasH1: boolean;
  h1Count: number;
  h1Content?: string[];
  hasStructuredData: boolean;
  structuredDataTypes?: string[];
  hasCanonical: boolean;
  canonicalUrl?: string;
  hasOGP: boolean;
  ogpProperties?: Record<string, string>;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  keywords?: string[];
}

export interface MobileCheckResult {
  hasViewport: boolean;
  viewportContent?: string;
  isMobileResponsive: boolean;
  touchTargetSize: boolean;
  textSizeReadable: boolean;
  horizontalScrolling: boolean;
  mobileScore: number;
}

export interface ConversionCheckResult {
  hasPhoneNumber: boolean;
  phoneNumbers?: string[];
  isPhoneClickable: boolean;
  hasContactForm: boolean;
  formFieldCount?: number;
  hasReservationButton: boolean;
  hasBusinessHours: boolean;
  businessHours?: string;
  hasAccessInfo: boolean;
  hasMap: boolean;
  hasSNSLinks: boolean;
  snsLinks?: string[];
  ctaElements: Array<{
    text: string;
    type: "button" | "link" | "form";
    isProminent: boolean;
  }>;
}

export interface ContentCheckResult {
  totalWords: number;
  hasImages: boolean;
  imageCount: number;
  imagesWithAlt: number;
  lastUpdated?: Date;
  readabilityScore: number;
  hasVideoContent: boolean;
  hasFAQ: boolean;
  hasTestimonials: boolean;
  contentQualityScore: number;
}

export interface IndustryConfig {
  keywords: string[];
  weightMultipliers: {
    performance: number;
    mobile: number;
    seo: number;
    conversion: number;
    content: number;
  };
  criticalElements: string[];
  averageMonthlyRevenue: number;
}

export interface ScoringWeights {
  performance: number;
  mobile: number;
  seo: number;
  conversion: number;
  content: number;
}

export interface AnalyzerConfig {
  performanceThreshold: number;
  mobileThreshold: number;
  seoThreshold: number;
  conversionThreshold: number;
  contentThreshold: number;
  pageSpeedApiKey?: string;
  googleMapsApiKey?: string;
  screenshotTimeout: number;
  maxConcurrentAnalyses: number;
  retryAttempts: number;
  retryDelay: number;
}