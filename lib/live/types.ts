export const LIVE_CONTENT_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;

export type LiveContentStatus = (typeof LIVE_CONTENT_STATUSES)[number];

export const LIVE_ANNOUNCEMENT_TONES = ["info", "important", "urgent"] as const;

export type LiveAnnouncementTone = (typeof LIVE_ANNOUNCEMENT_TONES)[number];

export const LIVE_EVENT_RESOURCE_KINDS = [
  "devpost",
  "workshop",
  "slides",
  "registration",
  "resource",
] as const;

export type LiveEventResourceKind = (typeof LIVE_EVENT_RESOURCE_KINDS)[number];

export type LiveSiteSettings = {
  eventName: string;
  heroTitle: string;
  heroDescription: string;
  timezone: string;
  devpostUrl: string | null;
  guideEmptyTitle: string;
  guideEmptyDescription: string;
  prizesEmptyTitle: string;
  prizesEmptyDescription: string;
};

export type EventResource = {
  id: string;
  kind: LiveEventResourceKind;
  label: string;
  href: string | null;
  position: number;
};

export type LiveEvent = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  location: string;
  locationDetails: string;
  mapUrl: string | null;
  eventType: string;
  hostName: string | null;
  audience: string | null;
  capacity: number | null;
  featured: boolean;
  status: LiveContentStatus;
  position: number;
  resources: EventResource[];
};

export type LiveAnnouncement = {
  id: string;
  title: string;
  body: string;
  tone: LiveAnnouncementTone;
  status: LiveContentStatus;
  postedAt: string | null;
  expiresAt: string | null;
  position: number;
};

export type GuideLink = {
  id: string;
  title: string;
  description: string;
  href: string;
  category: string;
  status: LiveContentStatus;
  position: number;
};

export type Prize = {
  id: string;
  title: string;
  description: string;
  sponsor: string | null;
  value: string | null;
  eligibility: string;
  judgingCriteria: string;
  href: string | null;
  status: LiveContentStatus;
  position: number;
};

export type LiveSiteContent = {
  settings: LiveSiteSettings;
  events: LiveEvent[];
  announcements: LiveAnnouncement[];
  guideLinks: GuideLink[];
  prizes: Prize[];
};
