import "server-only";

export const requiredEmailCampaignTestRecipients = [
  {
    email: "arnshah@umich.edu",
    mergeData: {
      first_name: "Arnav",
      last_name: "Shah",
      name: "Arnav Shah",
    },
  },
  {
    email: "anishcha@umich.edu",
    mergeData: {
      first_name: "Anish",
      last_name: "Chawla",
      name: "Anish Chawla",
    },
  },
  {
    email: "yeungh@umich.edu",
    mergeData: {
      first_name: "Howard",
      last_name: "Yeung",
      name: "Howard Yeung",
    },
  },
  {
    email: "amyliiu@umich.edu",
    mergeData: {
      first_name: "Amy",
      last_name: "Liu",
      name: "Amy Liu",
    },
  },
] as const;
