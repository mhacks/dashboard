import {
  BarChart3Icon,
  CalendarCheck2Icon,
  ClipboardCheckIcon,
  KeyRoundIcon,
  MailIcon,
  TrophyIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";

export type AdminLink = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export type AdminArea = {
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
  {
    title: "RSVPs",
    description: "Track attendance confirmations and event logistics.",
    icon: CalendarCheck2Icon,
    links: [
      {
        href: "/admin/rsvps",
        title: "Responses",
        description: "Review RSVP progress, logistics, receipts, and exports.",
        icon: CalendarCheck2Icon,
      },
      {
        href: "/admin/backdoor",
        title: "Backdoor",
        description: "Grant custom late RSVP windows for accepted applicants.",
        icon: KeyRoundIcon,
      },
    ],
  },
  {
    title: "Team",
    description: "Invite users and manage portal access.",
    icon: UsersRoundIcon,
    links: [
      {
        href: "/admin/team",
        title: "User invites",
        description: "Send email invitations and assign portal roles.",
        icon: UsersRoundIcon,
      },
    ],
  },
];
