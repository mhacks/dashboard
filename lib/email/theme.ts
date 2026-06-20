import type { EmailThemeTokens } from "@/lib/email/types";

export const defaultEmailTheme: EmailThemeTokens = {
  background: "#A7D98B",
  backgroundAccent: "#599CC5",
  border: "#ffffff",
  text: "#505050",
  muted: "#505050",
  panel: "#dedede",
  white: "#F6F1DE",
  pink: "#69A13B",
  cyan: "#599CC5",
  yellow: "#F6F1DE",
  green: "#69A13B",
  containerRadius: "0px",
  containerBorderWidth: "4px",
  containerPadding: "32px",
  headingSize: "24px",
  bodySize: "16px",
  ctaRadius: "999px",
  ctaBackground: "#A7D98B",
  ctaColor: "#ffffff",
  fontFamily: 'Inter,Avenir,"Avenir Next","Helvetica Neue",Arial,sans-serif',
};

export const emailTheme = {
  colors: {
    background: defaultEmailTheme.background,
    backgroundAccent: defaultEmailTheme.backgroundAccent,
    border: defaultEmailTheme.border,
    text: defaultEmailTheme.text,
    muted: defaultEmailTheme.muted,
    panel: defaultEmailTheme.panel,
    white: defaultEmailTheme.white,
    pink: defaultEmailTheme.pink,
    cyan: defaultEmailTheme.cyan,
    yellow: defaultEmailTheme.yellow,
    green: defaultEmailTheme.green,
  },
  spacing: {
    xs: "6px",
    sm: "10px",
    md: "18px",
    lg: "28px",
    xl: "42px",
  },
  fontFamily: defaultEmailTheme.fontFamily,
};

export const emailText = {
  paragraph: {
    color: defaultEmailTheme.text,
    fontSize: defaultEmailTheme.bodySize,
    lineHeight: "24px",
    margin: "24px 0",
  },
  small: {
    color: defaultEmailTheme.muted,
    fontSize: "12px",
    lineHeight: "18px",
    margin: "0",
  },
  heading: {
    color: "#050505",
    fontSize: defaultEmailTheme.headingSize,
    lineHeight: "30px",
    fontWeight: "700",
    margin: "8px 0 24px",
  },
  sectionHeading: {
    color: "#050505",
    fontSize: "20px",
    lineHeight: "30px",
    fontWeight: "700",
    margin: "0",
  },
};
