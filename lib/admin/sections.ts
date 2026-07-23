import {
  BarChart3Icon,
  ClipboardCheckIcon,
  MailIcon,
  TrophyIcon,
  type LucideIcon,
} from "lucide-react";

type AdminLink = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

type AdminArea = {
  title: string;
  description: string;
  icon: LucideIcon;
  links: AdminLink[];
};

export const ADMIN_AREAS: AdminArea[] = [
  {
    title: "Applications",
    description: "Review applicants and track organizer activity.",
    icon: ClipboardCheckIcon,
    links: [
      {
        href: "/admin/applications",
        title: "Reviews",
        description: "Score pending applications and collaborate live.",
        icon: ClipboardCheckIcon,
      },
      {
        href: "/admin/applications/leaderboard",
        title: "Leaderboard",
        description: "Completed reviews by organizer.",
        icon: TrophyIcon,
      },
      {
        href: "/admin/applications/analytics",
        title: "Analytics",
        description: "Demographics, locations, and score trends.",
        icon: BarChart3Icon,
      },
    ],
  },
  {
    title: "Communications",
    description: "Create and send organizer-managed email updates.",
    icon: MailIcon,
    links: [
      {
        href: "/admin/email-campaigns",
        title: "Email Campaigns",
        description:
          "Build templates, preview merge fields, and send CSV lists.",
        icon: MailIcon,
      },
    ],
  },
];
