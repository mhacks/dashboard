import {
  BarChart3Icon,
  ClipboardCheckIcon,
  TrophyIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";

type AdminLink = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  isActive?: (pathname: string) => boolean;
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
        isActive: (pathname) =>
          pathname === "/admin/applications" ||
          /^\/admin\/applications\/app_[a-f0-9]{24}$/.test(pathname),
      },
      {
        href: "/admin/applications/leaderboard",
        title: "Leaderboard",
        description: "Completed reviews by organizer.",
        icon: TrophyIcon,
        isActive: (pathname) =>
          pathname.startsWith("/admin/applications/leaderboard"),
      },
      {
        href: "/admin/applications/analytics",
        title: "Analytics",
        description: "Demographics, locations, and score trends.",
        icon: BarChart3Icon,
        isActive: (pathname) =>
          pathname.startsWith("/admin/applications/analytics"),
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
        description:
          "Send email invitations and assign organizer or hacker roles.",
        icon: UsersRoundIcon,
      },
    ],
  },
];
