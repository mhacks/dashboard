import { Suspense } from "react";
import ReviewDashboard from "./review-dashboard";
import ReviewDashboardSkeleton from "./review-dashboard-skeleton";
import { redirect } from "next/navigation";
import { HackerApplicant } from "@/lib/schemas/application";
export default async function ReviewPage() {
  // * Perform Data Fetching from Database here

  const profile = await getProfile();
  if (profile.role != "Admin") {
    redirect("/");
  }

  const applications = getApplicationData();

  return (
    <>
      <Suspense fallback={<ReviewDashboardSkeleton />}>
        <ReviewDashboard applicationsPromise={applications} />
      </Suspense>
    </>
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getProfile = async () => {
  await wait(1500);
  return { role: "Admin" };
};

const getApplicationData = async () => {
  const mock_applicants: HackerApplicant[] = [
    {
      id: "1",
      user_id: "user_1",
      name: "Alice Chen",
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
      mlhCodeOfConduct: true,
      mlhPrivacyPolicy: true,
      mlhEmails: true,
      status: "pending",
    },
    {
      id: "2",
      user_id: "user_2",
      name: "Marcus Johnson",
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
      mlhCodeOfConduct: true,
      mlhPrivacyPolicy: true,
      mlhEmails: true,
      status: "pending",
    },
    {
      id: "3",
      user_id: "user_3",
      name: "Priya Patel",
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
      mlhCodeOfConduct: true,
      mlhPrivacyPolicy: true,
      mlhEmails: true,
      status: "reviewed",
    },
    {
      id: "4",
      user_id: "user_4",
      name: "Jordan Smith",
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
      mlhCodeOfConduct: true,
      mlhPrivacyPolicy: true,
      mlhEmails: true,
      status: "flagged",
    },
    {
      id: "5",
      user_id: "user_5",
      name: "Wei Zhang",
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
      mlhCodeOfConduct: true,
      mlhPrivacyPolicy: true,
      mlhEmails: true,
      status: "pending",
    },
  ];
  return mock_applicants;
};
