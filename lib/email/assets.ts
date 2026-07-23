const driveImage = (fileId: string, width: number) =>
  `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;

// Temporary Drive-hosted email assets. Keep references centralized so the
// runtime host can move to mhacks.org or a CDN without touching templates.
export const emailAssets = {
  logoBadge: driveImage("1l-NaSdmxm4a6uhysDS7O2QAPgSxdsZLf", 160),
  flowerDivider: driveImage("1WJrT_P-BZe-zdO_q-Lxk3ghC3nIdXPhf", 900),
  socials: {
    linkedin: driveImage("14fsWSc52IJMFPtyNzM-r0n3esQb2x3kA", 72),
    instagram: driveImage("1F_xnHHxQ0fAjEFMwZWaPWBGCXNGIfPsn", 72),
    youtube: driveImage("1xnKYMWllVHeYE3R6fGGmBdLSfATo7AWi", 72),
    x: driveImage("1yHIHQM9iGCNBI-Jc_JqgC2_jaeIGFhTh", 72),
  },
} as const;

export const emailSocialLinks = {
  linkedin: "https://www.linkedin.com/company/mhacks",
  x: "https://x.com/mhacks",
  instagram: "https://www.instagram.com/mhacks_/",
  youtube: "https://www.youtube.com/@mhacks-official",
  website: "https://www.mhacks.org",
} as const;
