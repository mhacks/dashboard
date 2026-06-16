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
  text: string; // whyAttend — shown as the "body" preview in the list
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
  whyAttend: string;
  technicalChallenge: string;
  proudProject: string;
  anythingElse?: string;
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
    text: "MHacks has always been on my radar as one of the premier hackathons in the midwest. I want to push my skills in ML and build something meaningful with a team. Last year I built a mental-health chatbot at HackMIT and I am excited to iterate on those ideas with the incredibly talented community MHacks attracts.",
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
    whyAttend:
      "MHacks has always been on my radar as one of the premier hackathons in the midwest. I want to push my skills in ML and build something meaningful with a team. Last year I built a mental-health chatbot at HackMIT and I am excited to iterate on those ideas with the incredibly talented community MHacks attracts.",
    technicalChallenge:
      "During my internship at a startup I had to migrate a monolithic Flask API to microservices with zero downtime. I tackled this by implementing a strangler-fig pattern—routing traffic incrementally through a new gateway while keeping the old endpoints alive until confidence was high. The trickiest part was synchronizing database writes across services; I ended up using an outbox pattern with a Postgres trigger to fan out events.",
    proudProject:
      "I built StudySync, a real-time collaborative study tool that syncs Pomodoro timers and lets friends share notes via WebSockets. Over 300 students at my university use it. I designed the backend in Go, deployed on Fly.io, and added an AI summary feature using the OpenAI API.",
    anythingElse:
      "I play violin in the university orchestra and love hackathon karaoke nights!",
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
    text: "I want to attend MHacks to network with other engineers and learn from industry mentors. I have been working on embedded systems projects and I think a hackathon environment will push me to prototype faster.",
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
    whyAttend:
      "I want to attend MHacks to network with other engineers and learn from industry mentors. I have been working on embedded systems projects and I think a hackathon environment will push me to prototype faster.",
    technicalChallenge:
      "I had a race condition in an RTOS scheduler I was writing in C. The interrupt handler was modifying shared state without a critical section. I resolved it by using atomic operations and restructuring the ISR to queue events rather than process them inline.",
    proudProject:
      "I built a low-cost air quality monitor with an ESP32, a PM2.5 sensor, and a custom PCB. Data streams to a Firebase backend and displays on a React Native app. I open-sourced the hardware design and got 40 GitHub stars.",
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
    text: "I want to collaborate with builders from diverse disciplines. As a math major who codes, I bring a rigorous analytical lens to product problems. MHacks specifically attracts the type of interdisciplinary team I thrive in.",
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
    whyAttend:
      "I want to collaborate with builders from diverse disciplines. As a math major who codes, I bring a rigorous analytical lens to product problems. MHacks specifically attracts the type of interdisciplinary team I thrive in.",
    technicalChallenge:
      "I implemented a gradient descent optimizer from scratch for a research project on sparse neural networks. The tricky part was getting numerically stable updates with float32 precision. I used Kahan summation and gradient clipping, and validated against PyTorch's built-in optimizer.",
    proudProject:
      "During HackMIT I led a team of four to build a real-time sign-language translation app using MediaPipe and a custom GRU model. We won first place in the accessibility track. The model achieved 94% accuracy on ASL alphabet recognition.",
    anythingElse:
      "I am a TA for 18.06 (Linear Algebra) and love making math accessible.",
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
    text: "I want to attend to learn about technology and meet developers.",
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
    whyAttend:
      "I want to attend to learn about technology and meet developers.",
    technicalChallenge:
      "I had to fix a bug in a spreadsheet formula at my internship.",
    proudProject:
      "I built a simple budget tracker in Excel with some VBA macros. It helped my student org manage expenses.",
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
    text: "I have been a hackathon organizer at CMU for two years and I want to participate as a hacker this time. I am passionate about building developer tools and I see MHacks as the perfect venue to ship a CLI toolkit I have been designing.",
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
    whyAttend:
      "I have been a hackathon organizer at CMU for two years and I want to participate as a hacker this time. I am passionate about building developer tools and I see MHacks as the perfect venue to ship a CLI toolkit I have been designing.",
    technicalChallenge:
      "I rewrote a critical path in a distributed key-value store from a single-threaded model to an async Tokio-based architecture in Rust. The migration required careful management of lifetimes and a redesign of the error-propagation model. Throughput improved 4x.",
    proudProject:
      "MeshDB — an open-source mesh networking library for IoT devices that auto-discovers peers via mDNS and routes packets over BLE or WiFi. Used by 3 research labs and 200+ GitHub stars.",
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
