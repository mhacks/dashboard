import * as React from "react";

// Extends the shadcn mail example's Mail shape with hacker applicant fields.
// `subject`, `text`, `read`, and `labels` are synthetic fields that map the
// applicant data onto the mail-list/mail-display UI without changing those
// component contracts.

export type ApplicantData = {
  // ── Mail-UI fields (drive list + display layout) ──────────────────────────
  id: string;
  name: string;
  email: string;
  subject: string; // university · major · degree
  text: string; // whatWouldYouDo — shown as the "body" preview in the list
  date: string; // mock submission timestamp
  read: boolean; // true = reviewed or flagged (not pending)
  labels: string[]; // [status] — drives badge in list

  // ── Extended applicant fields ─────────────────────────────────────────────
  university: string;
  major: string;
  degree: string;
  graduationYear: number;
  age: number;
  gender: string;
  ethnicity: string;
  country: string;
  previousHackathons: number;
  whatWouldYouDo: string;
  whyMhacks: string;
  hillToDieOn: string;
  github?: string;
  linkedin?: string;
  personalSite?: string;
  transportationType: string;
  comingFrom: string;
  shirtSize: string;
  hasAllergies: boolean;
  allergiesDescription?: string;
  needsTravelReimbursement: boolean;
  status: "pending" | "reviewed" | "flagged";

  // Review fields
  reviewMotivation?: number;
  reviewBuilderMindset?: number;
  reviewCollaboration?: number;
  reviewCreativity?: number;
  reviewDiversity?: number;
  flagForReview?: boolean;
  reviewNotes?: string;
};

const makeSubject = (university: string, major: string, degree: string) =>
  `${university} · ${major} · ${degree}`;

export const data: ApplicantData[] = [
  {
    id: "1",
    name: "Alice Chen",
    email: "alice.chen@umich.edu",
    subject: makeSubject(
      "University of Michigan",
      "Computer Science",
      "Bachelor's",
    ),
    text: "Ship a real-time ML inference API in 24 hours and see if it holds up under stress.",
    date: "2026-05-10T09:00:00",
    read: false,
    labels: ["pending"],
    university: "University of Michigan",
    major: "Computer Science",
    degree: "Bachelor's",
    graduationYear: 2026,
    age: 21,
    gender: "Female",
    ethnicity: "Asian",
    country: "United States",
    previousHackathons: 4,
    whatWouldYouDo:
      "Ship a real-time ML inference API in 24 hours and see if it holds up under stress.",
    whyMhacks:
      "MHacks has always been on my radar as one of the premier hackathons in the midwest. I want to push my skills in ML and build something meaningful with a team. Last year I built a mental-health chatbot at HackMIT and I am excited to iterate on those ideas with the incredibly talented community MHacks attracts.",
    hillToDieOn: "Tabs over spaces, always.",
    github: "https://github.com/alicechendev",
    linkedin: "https://linkedin.com/in/alice-chen",
    transportationType: "Driving",
    comingFrom: "Ann Arbor, MI",
    shirtSize: "S",
    hasAllergies: false,
    needsTravelReimbursement: false,
    status: "pending",
  },
  {
    id: "2",
    name: "Marcus Johnson",
    email: "marcus.johnson@gatech.edu",
    subject: makeSubject(
      "Georgia Institute of Technology",
      "Computer Engineering",
      "Bachelor's",
    ),
    text: "Build a low-power mesh sensor network and demo it live to judges.",
    date: "2026-05-11T10:30:00",
    read: false,
    labels: ["pending"],
    university: "Georgia Institute of Technology",
    major: "Computer Engineering",
    degree: "Bachelor's",
    graduationYear: 2027,
    age: 20,
    gender: "Male",
    ethnicity: "Black or African American",
    country: "United States",
    previousHackathons: 2,
    whatWouldYouDo:
      "Build a low-power mesh sensor network and demo it live to judges.",
    whyMhacks:
      "I want to attend MHacks to network with other engineers and learn from industry mentors. I have been working on embedded systems projects and I think a hackathon environment will push me to prototype faster.",
    hillToDieOn: "Hardware is harder than software and more rewarding.",
    github: "https://github.com/mjohnsonEE",
    transportationType: "Flying",
    comingFrom: "Atlanta, GA",
    shirtSize: "L",
    hasAllergies: false,
    needsTravelReimbursement: true,
    status: "pending",
  },
  {
    id: "3",
    name: "Priya Patel",
    email: "priya.patel@mit.edu",
    subject: makeSubject(
      "Massachusetts Institute of Technology",
      "Mathematics",
      "Bachelor's",
    ),
    text: "Build a sign-language translation app that works offline using a custom GRU model.",
    date: "2026-05-09T13:15:00",
    read: true,
    labels: ["reviewed"],
    university: "Massachusetts Institute of Technology",
    major: "Mathematics",
    degree: "Bachelor's",
    graduationYear: 2026,
    age: 22,
    gender: "Female",
    ethnicity: "Asian",
    country: "United States",
    previousHackathons: 6,
    whatWouldYouDo:
      "Build a sign-language translation app that works offline using a custom GRU model.",
    whyMhacks:
      "I want to collaborate with builders from diverse disciplines. As a math major who codes, I bring a rigorous analytical lens to product problems. MHacks specifically attracts the type of interdisciplinary team I thrive in.",
    hillToDieOn: "Math is the only truly general-purpose language.",
    github: "https://github.com/priyapatel-math",
    linkedin: "https://linkedin.com/in/priya-patel-mit",
    personalSite: "https://priyapatel.dev",
    transportationType: "Train",
    comingFrom: "Cambridge, MA",
    shirtSize: "XS",
    hasAllergies: true,
    allergiesDescription: "Tree nuts",
    needsTravelReimbursement: false,
    status: "reviewed",
  },
  {
    id: "4",
    name: "Jordan Smith",
    email: "jordan.smith@illinois.edu",
    subject: makeSubject(
      "University of Illinois at Urbana-Champaign",
      "Business",
      "Bachelor's",
    ),
    text: "Learn from developers and maybe build a simple web app.",
    date: "2026-05-12T14:00:00",
    read: true,
    labels: ["flagged"],
    university: "University of Illinois at Urbana-Champaign",
    major: "Business",
    degree: "Bachelor's",
    graduationYear: 2027,
    age: 20,
    gender: "Other",
    ethnicity: "White",
    country: "United States",
    previousHackathons: 0,
    whatWouldYouDo: "Learn from developers and maybe build a simple web app.",
    whyMhacks: "I want to attend to learn about technology and meet developers.",
    hillToDieOn: "Excel is a perfectly valid programming language.",
    transportationType: "Driving",
    comingFrom: "Champaign, IL",
    shirtSize: "M",
    hasAllergies: false,
    needsTravelReimbursement: false,
    status: "flagged",
  },
  {
    id: "5",
    name: "Wei Zhang",
    email: "wei.zhang@cmu.edu",
    subject: makeSubject(
      "Carnegie Mellon University",
      "Computer Science",
      "Master's",
    ),
    text: "Ship v1 of a CLI toolkit for local LLM orchestration in 24 hours.",
    date: "2026-05-08T17:45:00",
    read: false,
    labels: ["pending"],
    university: "Carnegie Mellon University",
    major: "Computer Science",
    degree: "Master's",
    graduationYear: 2026,
    age: 24,
    gender: "Male",
    ethnicity: "Asian",
    country: "United States",
    previousHackathons: 8,
    whatWouldYouDo:
      "Ship v1 of a CLI toolkit for local LLM orchestration in 24 hours.",
    whyMhacks:
      "I have been a hackathon organizer at CMU for two years and I want to participate as a hacker this time. I am passionate about building developer tools and I see MHacks as the perfect venue to ship a CLI toolkit I have been designing.",
    hillToDieOn: "Rust's borrow checker has never been wrong, ever.",
    github: "https://github.com/wzhang-cmu",
    linkedin: "https://linkedin.com/in/wei-zhang-cmu",
    personalSite: "https://weizhang.io",
    transportationType: "Driving",
    comingFrom: "Pittsburgh, PA",
    shirtSize: "M",
    hasAllergies: false,
    needsTravelReimbursement: false,
    status: "pending",
  },
];

export type Account = {
  label: string;
  email: string;
  icon: React.ReactNode;
};

export const accounts: Account[] = [
  {
    label: "MHacks Admin",
    email: "admin@mhacks.org",
    icon: (
      <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <title>MHacks</title>
        <path
          d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];
