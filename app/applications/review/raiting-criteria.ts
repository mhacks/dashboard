interface ReviewFormData {
  motivation: number | undefined;
  builderMindset: number | undefined;
  collaboration: number | undefined;
  creativity: number | undefined;
  diversity: number | undefined;
  flagForReview: boolean;
  reviewComments: string;
}

const RATING_CRITERIA: {
  key: keyof Omit<ReviewFormData, "flagForReview" | "reviewComments">;
  label: string;
  descriptions: Record<number, string>;
}[] = [
  {
    key: "motivation",
    label: "Motivation / Interest",
    descriptions: {
      1: "Generic answer, unclear why they want to attend",
      2: "Some interest but mostly vague",
      3: "Clear interest in attending and learning",
      4: "Strong enthusiasm with specific reasons",
      5: "Exceptional passion and strong alignment with the hackathon",
    },
  },
  {
    key: "builderMindset",
    label: "Builder Mindset / Initiative",
    descriptions: {
      1: "No evidence of building projects",
      2: "Limited coursework examples only",
      3: "Some personal or academic projects",
      4: "Multiple projects or hackathon experience",
      5: "Strong portfolio, startups, open source, or significant projects",
    },
  },
  {
    key: "collaboration",
    label: "Collaboration / Community",
    descriptions: {
      1: "No evidence of teamwork or collaboration",
      2: "Minimal teamwork experience",
      3: "Some collaborative experiences",
      4: "Strong teamwork or leadership examples",
      5: "Exceptional collaborator, mentor, or community contributor",
    },
  },
  {
    key: "creativity",
    label: "Creativity / Curiosity",
    descriptions: {
      1: "Conventional answers, little creativity",
      2: "Slight originality",
      3: "Moderately interesting ideas",
      4: "Creative thinker with interesting perspectives",
      5: "Highly original and innovative ideas",
    },
  },
  {
    key: "diversity",
    label: "Diversity of Perspective / Background",
    descriptions: {
      1: "Very common background relative to applicant pool",
      2: "Slightly different perspective",
      3: "Moderately unique experiences or background",
      4: "Strongly adds interdisciplinary perspective",
      5: "Highly unique background that broadens the participant pool",
    },
  },
];
