"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useDefaultLayout,
  usePanelRef,
  type LayoutStorage,
} from "react-resizable-panels";
import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileText,
  Filter,
  Laptop,
  ListChecks,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Pencil,
  Play,
  Plus,
  Save,
  Send,
  Sparkles,
  Smartphone,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMounted } from "@/hooks/use-mounted";
import {
  buildAiTemplateContext,
  toAiDraftTemplateContext,
} from "@/lib/email/campaigns/ai-draft-context";
import type {
  EmailAudienceQuery,
  EmailCampaignContent,
  EmailThemeTokens,
} from "@/lib/email/types";
import { cn } from "@/lib/utils";
import {
  deleteEmailTemplateAction,
  findActiveDirectSendAction,
  generateEmailTemplateDraftAction,
  parseDirectRecipientsAction,
  renderEmailPreviewAction,
  resolveEmailAudienceAction,
  saveEmailTemplateAction,
  saveEmailThemeAction,
  sendDirectBatchAction,
  sendDirectTestEmailsAction,
  sendOneDirectEmailAction,
} from "./actions";

type PreviewMode = "desktop" | "mobile";
export type EmailCampaignSurface = "builder" | "styles" | "send";
type TemplateType = "structured" | "html";
type ToastTone = "loading" | "success" | "error" | "info";
type RecipientSource = "manual" | "audience";

export interface MasterTemplate {
  id: string;
  name: string;
  type: TemplateType;
  description: string;
  subject: string;
  previewText: string;
  content: EmailCampaignContent | null;
  html: string | null;
  status: string;
  updatedAt: string;
  sourceTemplateId: string;
}

interface CampaignLimits {
  maxRecipients: number;
  batchSize: number;
  sendDelayMs: number;
  maxSendRatePerSecond?: number;
}

interface RecipientSaveResult {
  emails: string[];
  invalid: string[];
  duplicateCount: number;
  columns?: string[];
}

interface AudienceResolveResult extends RecipientSaveResult {
  recipientText: string;
  label: string;
}

interface DirectSendStatus {
  runId: string;
  proofKey?: string;
  interrupted: boolean;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  sendingCount: number;
  leaseActive: boolean;
  leaseExpiresAt: string | null;
  nextCursor: number;
  complete: boolean;
  invalid: string[];
  duplicateCount: number;
  columns?: string[];
  unverifiedRecipients: string[];
  recentFailures: Array<{
    email: string;
    error: string | null;
  }>;
}

interface TestSendProof {
  token: string;
  expiresAt: string;
  proofKey: string;
  sentCount: number;
  totalCount: number;
}

interface ToastState {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

const themeStorageKey = "mhacks-email-active-theme";
const themeStorageVersionKey = "mhacks-email-active-theme-version";
const currentThemeStorageVersion = "m26-single-font-config";
const activeSendStatusStorageKey = "mhacks-email-active-send-status";
const activeSendRecipientsStorageKey = "mhacks-email-active-send-recipients";
const activeTestProofStorageKey = "mhacks-email-active-test-proof";
const EMAIL_WORKSPACE_PANEL_IDS = [
  "templates-list",
  "campaign-workspace",
  "preview",
] as const;
const PANEL_LAYOUT_STORAGE: LayoutStorage = {
  getItem(key) {
    try {
      return typeof window === "undefined"
        ? null
        : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore storage failures (private mode, quota, etc.)
    }
  },
};
const builtInRecipientMergeFields = new Set(["email", "name"]);
const serverManagedTestListLabel =
  "Server-managed required organizer test list";
const defaultAudienceQuery: EmailAudienceQuery = {
  decisionGroup: "all_applicants",
  travelAward: "any",
  rsvpTravelPlan: "any",
};
const audienceDecisionOptions = [
  ["all_applicants", "All applicants"],
  ["draft", "Draft application (not submitted)"],
  ["umich", "All @umich.edu users"],
  ["accepted", "All accepted"],
  ["rsvped", "All RSVPed"],
  ["rejected", "All rejected"],
  ["early_accepted_or_rsvped", "Early accepted or RSVPed"],
  ["regular_accepted_or_rsvped", "Regular accepted or RSVPed"],
  ["applied", "Applied"],
  ["early_accepted", "Early accepted"],
  ["early_rsvped", "Early RSVPed"],
  ["early_rejected", "Early rejected"],
  ["regular_accepted", "Regular accepted"],
  ["regular_rsvped", "Regular RSVPed"],
  ["regular_rejected", "Regular rejected"],
] satisfies Array<[EmailAudienceQuery["decisionGroup"], string]>;
const audienceTravelAwardOptions = [
  ["any", "Any travel award"],
  ["approved", "Approved travel reimbursement"],
  ["none", "No approved travel reimbursement"],
] satisfies Array<[EmailAudienceQuery["travelAward"], string]>;
const audienceRsvpTravelPlanOptions = [
  ["any", "Any RSVP travel plan"],
  ["local", "Local"],
  ["self-funded", "Self-funded"],
  ["reimbursement", "Reimbursement"],
] satisfies Array<[EmailAudienceQuery["rsvpTravelPlan"], string]>;
const emailCampaignViews: Array<{
  value: EmailCampaignSurface;
  label: string;
  icon: typeof FileText;
}> = [
  { value: "builder", label: "Builder", icon: FileText },
  { value: "styles", label: "Styles", icon: Palette },
  { value: "send", label: "Send", icon: Send },
];

export default function EmailCampaignsClient({
  initialSurface,
  initialTemplates,
  initialTheme,
  initialCampaignLimits,
}: {
  initialSurface: EmailCampaignSurface;
  initialTemplates: MasterTemplate[];
  initialTheme: EmailThemeTokens;
  initialCampaignLimits: CampaignLimits;
}) {
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const toastIdRef = useRef(0);
  const [surface, setSurface] = useState<EmailCampaignSurface>(initialSurface);
  const [templates, setTemplates] =
    useState<MasterTemplate[]>(initialTemplates);
  const [campaignLimits] = useState<CampaignLimits>(initialCampaignLimits);
  const [recipientText, setRecipientText] = useState(() =>
    loadStoredSendRecipients(),
  );
  const [recipientResult, setRecipientResult] =
    useState<RecipientSaveResult | null>(null);
  const [recipientSource, setRecipientSource] =
    useState<RecipientSource>("manual");
  const [audienceQuery, setAudienceQuery] =
    useState<EmailAudienceQuery>(defaultAudienceQuery);
  const [audienceLabel, setAudienceLabel] = useState("");
  const [sendOneEmail, setSendOneEmail] = useState("");
  const testEmails = serverManagedTestListLabel;
  const [sendNotice, setSendNotice] = useState("");
  const [sendStatus, setSendStatus] = useState<DirectSendStatus | null>(() =>
    loadStoredSendStatus(),
  );
  const [testSendProof, setTestSendProof] = useState<TestSendProof | null>(() =>
    loadStoredTestSendProof(),
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    initialTemplates[0]?.id ?? "",
  );
  const [templatesPanelCollapsed, setTemplatesPanelCollapsed] = useState(false);
  const panelsMounted = useMounted();
  const templatesPanelRef = usePanelRef();
  const panelLayout = useDefaultLayout({
    id: "email-campaign-workspace",
    panelIds: [...EMAIL_WORKSPACE_PANEL_IDS],
    storage: PANEL_LAYOUT_STORAGE,
  });

  useEffect(() => {
    if (!panelsMounted) {
      return;
    }

    setTemplatesPanelCollapsed(
      templatesPanelRef.current?.isCollapsed() ?? false,
    );
  }, [panelsMounted, templatesPanelRef]);

  const [theme, setTheme] = useState<EmailThemeTokens>(initialTheme);
  const [mergePreviewData, setMergePreviewData] = useState<
    Record<string, string>
  >({});
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [notice, setNotice] = useState("");
  const [aiDraftText, setAiDraftText] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );
  const mergeFields = useMemo(
    () => (selectedTemplate ? extractMergeFields(selectedTemplate) : []),
    [selectedTemplate],
  );
  const currentTestProofKey = useMemo(
    () => buildTestSendProofKey(selectedTemplate, theme),
    [selectedTemplate, theme],
  );
  const activeTestSendProof = freshTestSendProof(
    testSendProof,
    currentTestProofKey,
  );
  const activeSendStatus =
    sendStatus?.proofKey === currentTestProofKey ? sendStatus : null;
  const effectiveMergePreviewData = useMemo(
    () => ensureMergePreviewData(mergeFields, mergePreviewData),
    [mergeFields, mergePreviewData],
  );

  async function saveTemplateToMaster() {
    if (!selectedTemplate) return;

    const previousTemplateId = selectedTemplate.id;
    setBusy("save-template");
    try {
      const saved = await persistTemplate(selectedTemplate);
      replaceTemplate(saved, previousTemplateId);
      setSelectedTemplateId(saved.id);
      clearSendStatus();
      setNotice("Template saved.");
      showToast("success", "Template saved", "Saved to the database.");
    } catch {
      setNotice("Template could not be saved to the database.");
      showToast(
        "error",
        "Template save failed",
        "The local draft is still visible, but it was not persisted.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveStyles() {
    setBusy("save-styles");
    try {
      const savedTheme = await saveEmailThemeAction(theme);
      setTheme(savedTheme);
      clearSendStatus();
      storeTheme(savedTheme);
      setNotice("Styles saved.");
      showToast("success", "Styles saved", "Saved to the database.");
    } catch {
      setNotice("Styles could not be saved to the database.");
      showToast(
        "error",
        "Styles save failed",
        "The current styles are still visible locally, but were not persisted.",
      );
    } finally {
      setBusy(null);
    }
  }

  function handleWorkspaceSave() {
    if (surface === "styles") {
      void saveStyles();
    } else {
      void saveTemplateToMaster();
    }
  }

  function createStructuredTemplate() {
    const template: MasterTemplate = {
      id: `local-template-${crypto.randomUUID()}`,
      name: "New MHacks template",
      type: "structured",
      description: "Reusable campaign template",
      subject: "An update from MHacks",
      previewText: "A quick update from the MHacks team.",
      content: {
        eyebrow: "MHacks Update",
        heading: "A new MHacks update",
        intro: "Hi {{name}},",
        sections: [
          {
            id: crypto.randomUUID(),
            title: "What to know",
            body: "Add the main message for this campaign.",
          },
        ],
        cta: {
          label: "Learn more",
          url: "https://mhacks.org",
        },
        footerNote: "Questions? Reach out to the MHacks team.",
      },
      html: null,
      status: "active",
      updatedAt: new Date().toISOString(),
      sourceTemplateId: "mhacks-announcement",
    };

    const nextTemplates = [template, ...templates];
    setTemplates(nextTemplates);
    setSelectedTemplateId(template.id);
    clearSendStatus();
    setNotice("Template created.");
  }

  async function uploadHtmlTemplate(file: File) {
    const html = await file.text();
    const template: MasterTemplate = {
      id: `local-template-${crypto.randomUUID()}`,
      name: file.name.replace(/\.html$/i, "") || "Uploaded template",
      type: "html",
      description: "Uploaded HTML email",
      subject: "An update from MHacks",
      previewText: "A quick update from the MHacks team.",
      content: null,
      html,
      status: "active",
      updatedAt: new Date().toISOString(),
      sourceTemplateId: "mhacks-announcement",
    };

    setBusy("upload");
    try {
      const savedTemplate = await persistTemplate(template);
      const nextTemplates = [savedTemplate, ...templates];
      setTemplates(nextTemplates);
      setSelectedTemplateId(savedTemplate.id);
      clearSendStatus();
      setNotice("Template uploaded.");
      showToast("success", "Template uploaded", "Saved to the database.");
    } catch {
      const nextTemplates = [template, ...templates];
      setTemplates(nextTemplates);
      setSelectedTemplateId(template.id);
      clearSendStatus();
      setNotice("Upload kept as a local draft. Database save failed.");
      showToast(
        "error",
        "Upload save failed",
        "The uploaded template is local only until it saves successfully.",
      );
    } finally {
      setBusy(null);
      if (uploadRef.current) {
        uploadRef.current.value = "";
      }
    }
  }

  function updateSelectedTemplate(patch: Partial<MasterTemplate>) {
    if (!selectedTemplate) return;
    const nextTemplate = {
      ...selectedTemplate,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    replaceTemplate(nextTemplate);
  }

  function updateContent(patch: Partial<EmailCampaignContent>) {
    if (!selectedTemplate?.content) return;
    updateSelectedTemplate({
      content: {
        ...selectedTemplate.content,
        ...patch,
      },
    });
  }

  function updateSection(
    index: number,
    patch: Partial<EmailCampaignContent["sections"][number]>,
  ) {
    if (!selectedTemplate?.content) return;
    updateContent({
      sections: selectedTemplate.content.sections.map(
        (section, sectionIndex) =>
          sectionIndex === index ? { ...section, ...patch } : section,
      ),
    });
  }

  function addSection() {
    if (!selectedTemplate?.content) return;
    updateContent({
      sections: [
        ...selectedTemplate.content.sections,
        {
          id: crypto.randomUUID(),
          title: "New section",
          body: "Add more detail here.",
        },
      ],
    });
  }

  function removeSection(index: number) {
    if (!selectedTemplate?.content) return;
    const sections = selectedTemplate.content.sections.filter(
      (_section, sectionIndex) => sectionIndex !== index,
    );
    updateContent({ sections });
  }

  function moveSection(index: number, direction: -1 | 1) {
    if (!selectedTemplate?.content) return;
    const nextIndex = index + direction;
    const sections = [...selectedTemplate.content.sections];
    if (nextIndex < 0 || nextIndex >= sections.length) return;
    const [section] = sections.splice(index, 1);
    sections.splice(nextIndex, 0, section);
    updateContent({ sections });
  }

  function replaceTemplate(template: MasterTemplate, previousId = template.id) {
    let replaced = false;
    const nextTemplates = templates.map((current) => {
      if (current.id !== previousId) {
        return current;
      }

      replaced = true;
      return template;
    });

    if (!replaced) {
      nextTemplates.unshift(template);
    }

    setTemplates(nextTemplates);
  }

  async function deleteSelectedTemplate() {
    if (!selectedTemplate) return;
    const templateToDelete = selectedTemplate;

    setBusy("delete-template");
    try {
      if (!isDraftTemplateId(templateToDelete.id)) {
        await deleteEmailTemplateAction(templateToDelete.id);
      }

      const nextTemplates = templates.filter(
        (template) => template.id !== templateToDelete.id,
      );
      setTemplates(nextTemplates);
      setSelectedTemplateId(nextTemplates[0]?.id ?? "");
      clearSendStatus();
      setNotice("Template removed.");
      showToast("success", "Template removed", "Removed from the database.");
    } catch (error) {
      const message = errorMessage(error);
      setNotice(message);
      showToast("error", "Template remove failed", message);
    } finally {
      setBusy(null);
    }
  }

  function downloadSelectedTemplate() {
    if (!selectedTemplate) return;

    const baseName = slugifyFilename(selectedTemplate.name || "email-template");

    if (selectedTemplate.type === "html") {
      downloadTextFile({
        filename: `${baseName}.html`,
        mimeType: "text/html;charset=utf-8",
        content: selectedTemplate.html ?? "",
      });
      showToast("success", "Template downloaded", `${baseName}.html`);
      return;
    }

    downloadTextFile({
      filename: `${baseName}.json`,
      mimeType: "application/json;charset=utf-8",
      content: JSON.stringify(
        {
          schema: "mhacks-email-template/v1",
          exportedAt: new Date().toISOString(),
          template: selectedTemplate,
          theme,
        },
        null,
        2,
      ),
    });
    showToast("success", "Template downloaded", `${baseName}.json`);
  }

  async function copyAiTemplateContext() {
    if (!selectedTemplate) return;

    try {
      const context = buildAiTemplateContext(
        toAiDraftTemplateContext(selectedTemplate),
        mergeFields,
        defaultMergeSamples,
      );
      await window.navigator.clipboard.writeText(context);
      setNotice("AI context copied.");
      showToast(
        "success",
        "AI context copied",
        "Paste it into your local agent or ChatGPT, then import the JSON draft here.",
      );
    } catch {
      setNotice("Could not copy AI context.");
      showToast("error", "Could not copy AI context");
    }
  }

  async function generateAiTemplateDraft() {
    if (!selectedTemplate || !aiDescription.trim()) return;

    setBusy("generate-ai-draft");

    try {
      const result = await generateEmailTemplateDraftAction({
        description: aiDescription.trim(),
        template: toAiDraftTemplateContext(selectedTemplate),
        mergeFields,
      });
      setAiDraftText(result.draftText);
      setNotice(
        `Draft generated with ${result.model}. Review the JSON below, then import it.`,
      );
      showToast(
        "success",
        "Draft generated",
        `Model: ${result.model}. Review before importing.`,
      );
    } catch (error) {
      const message = errorMessage(error);
      setNotice(message);
      showToast("error", "Draft generation failed", message);
    } finally {
      setBusy(null);
    }
  }

  function importAiTemplateDraft() {
    if (!selectedTemplate) return;

    try {
      const draft = parseAiTemplateDraft(
        aiDraftText,
        selectedTemplate,
        mergeFields,
      );
      updateSelectedTemplate(draft);
      clearSendStatus();
      setAiDraftText("");
      setNotice(
        "AI draft applied to the current template. Review before saving.",
      );
      showToast(
        "success",
        "AI draft applied",
        "Review the changes, then save the template.",
      );
    } catch (error) {
      const message = errorMessage(error);
      setNotice(message);
      showToast("error", "AI draft rejected", message);
    }
  }

  async function renderPreview(
    template: MasterTemplate,
    activeTheme: EmailThemeTokens,
    activeMergeData: Record<string, string>,
  ) {
    const payload =
      template.type === "html"
        ? {
            type: "html" as const,
            subject: template.subject,
            previewText: template.previewText,
            html: template.html ?? "",
            mergeData: activeMergeData,
          }
        : {
            type: "structured" as const,
            templateId: template.sourceTemplateId,
            subject: template.subject,
            previewText: template.previewText,
            content: template.content,
            theme: activeTheme,
            mergeData: activeMergeData,
          };

    try {
      const rendered = await renderEmailPreviewAction(payload);
      setPreviewHtml(rendered.html);
    } catch {
      setPreviewHtml("");
    }
  }

  async function checkRecipientList() {
    setBusy("check-recipients");
    setSendNotice("");
    setAudienceLabel("");
    showToast(
      "loading",
      "Checking recipient list",
      "Validating addresses and merge columns.",
    );
    try {
      const template = buildDirectSendTemplate(selectedTemplate, theme);
      const [parsed, recoveredStatus] = await Promise.all([
        parseDirectRecipientsAction({ recipients: recipientText }),
        template
          ? findActiveDirectSendAction({
              template,
              recipients: recipientText,
            })
          : Promise.resolve(null),
      ]);
      setRecipientResult(parsed);
      if (recoveredStatus) {
        commitSendStatus({
          ...recoveredStatus,
          proofKey: currentTestProofKey,
        });
      } else {
        clearSendStatus();
      }
      setSendNotice(
        recoveredStatus
          ? `Recovered send: ${recoveredStatus.sentCount} sent, ${recoveredStatus.pendingCount} pending.`
          : `${parsed.emails.length} recipients ready.`,
      );
      showToast(
        recoveredStatus ? "info" : "success",
        recoveredStatus ? "Saved send recovered" : "Recipient list ready",
        recoveredStatus
          ? `${recoveredStatus.sentCount} sent, ${recoveredStatus.failedCount} failed, ${recoveredStatus.pendingCount} pending.`
          : `${parsed.emails.length} valid, ${parsed.duplicateCount} duplicate${
              parsed.duplicateCount === 1 ? "" : "s"
            }, ${parsed.invalid.length} invalid.`,
      );
    } catch (error) {
      const message = errorMessage(error);
      setSendNotice(message);
      showToast("error", "Could not check list", message);
    } finally {
      setBusy(null);
    }
  }

  async function loadAudienceRecipients() {
    setBusy("load-audience");
    setSendNotice("");
    showToast(
      "loading",
      "Loading group",
      "Resolving recipients from Supabase.",
    );
    try {
      const resolved = (await resolveEmailAudienceAction({
        query: audienceQuery,
      })) as AudienceResolveResult;
      setRecipientText(resolved.recipientText);
      storeSendRecipients(resolved.recipientText);
      setRecipientResult(resolved);
      setAudienceLabel(resolved.label);
      const template = buildDirectSendTemplate(selectedTemplate, theme);
      const recoveredStatus = template
        ? await findActiveDirectSendAction({
            template,
            recipients: resolved.recipientText,
          })
        : null;
      if (recoveredStatus) {
        commitSendStatus({
          ...recoveredStatus,
          proofKey: currentTestProofKey,
        });
      } else {
        clearSendStatus();
      }
      setSendNotice(
        recoveredStatus
          ? `Recovered send: ${recoveredStatus.sentCount} sent, ${recoveredStatus.pendingCount} pending.`
          : `${resolved.emails.length} recipients loaded.`,
      );
      showToast(
        recoveredStatus ? "info" : "success",
        recoveredStatus ? "Saved send recovered" : "Group loaded",
        recoveredStatus
          ? `${recoveredStatus.sentCount} sent, ${recoveredStatus.failedCount} failed, ${recoveredStatus.pendingCount} pending.`
          : `${resolved.emails.length} valid recipient${
              resolved.emails.length === 1 ? "" : "s"
            } from ${resolved.label}.`,
      );
    } catch (error) {
      const message = errorMessage(error);
      setSendNotice(message);
      showToast("error", "Could not load group", message);
    } finally {
      setBusy(null);
    }
  }

  function updateAudienceQuery(patch: Partial<EmailAudienceQuery>) {
    setAudienceQuery((current) => ({ ...current, ...patch }));
    setAudienceLabel("");
    setRecipientResult(null);
    setRecipientText("");
    removeStoredSendRecipients();
    clearSendStatus();
  }

  function changeRecipientSource(source: RecipientSource) {
    setRecipientSource(source);
    setRecipientResult(null);
    setAudienceLabel("");
    clearSendStatus();

    if (source === "audience") {
      setRecipientText("");
      removeStoredSendRecipients();
    }
  }

  async function sendOneRecipient() {
    const template = buildDirectSendTemplate(selectedTemplate, theme);
    if (!template) return;

    setBusy("send-one");
    setSendNotice("");
    showToast("loading", "Sending email", `Sending to ${sendOneEmail}.`);
    try {
      const data = await sendOneDirectEmailAction({
        template,
        email: sendOneEmail,
        mergeData: effectiveMergePreviewData,
      });
      setSendNotice(
        data.result.status === "sent"
          ? "Single email sent."
          : data.result.error || "Single email failed.",
      );
      if (data.result.status === "sent") {
        showToast("success", "Email sent", `Sent to ${sendOneEmail}.`);
      } else {
        showToast(
          "error",
          "Email failed",
          data.result.error || "Single email failed.",
        );
      }
    } catch (error) {
      const message = errorMessage(error);
      setSendNotice(message);
      showToast("error", "Email failed", message);
    } finally {
      setBusy(null);
    }
  }

  async function sendTestEmails() {
    const template = buildDirectSendTemplate(selectedTemplate, theme);
    if (!template) return;

    setBusy("test-send");
    setSendNotice("Sending required test emails...");
    showToast(
      "loading",
      "Sending test email",
      "Required server-managed test addresses queued.",
    );
    try {
      const data = await sendDirectTestEmailsAction({
        template,
        mergeData: effectiveMergePreviewData,
      });
      const sent = data.results.filter((result) => result.status === "sent");
      const firstFailure = data.results.find(
        (result) => result.status !== "sent",
      );
      if (sent.length > 0 && data.testSendToken && data.testSendExpiresAt) {
        commitTestSendProof({
          token: data.testSendToken,
          expiresAt: data.testSendExpiresAt,
          proofKey: currentTestProofKey,
          sentCount: sent.length,
          totalCount: data.results.length,
        });
      } else {
        clearTestSendProof();
      }
      setSendNotice(
        firstFailure?.error
          ? `${sent.length}/${data.results.length} test emails sent. ${firstFailure.error}`
          : `${sent.length}/${data.results.length} test emails sent.`,
      );
      showToast(
        firstFailure ? "error" : "success",
        firstFailure ? "Test send finished with errors" : "Test email sent",
        firstFailure?.error ??
          `${sent.length}/${data.results.length} test email${
            data.results.length === 1 ? "" : "s"
          } sent.`,
      );
    } catch (error) {
      const message = errorMessage(error);
      clearTestSendProof();
      setSendNotice(message);
      showToast("error", "Test send failed", message);
    } finally {
      setBusy(null);
    }
  }

  async function startFullSend() {
    const template = buildDirectSendTemplate(selectedTemplate, theme);
    if (!template) return;
    const proof = activeTestSendProof;

    if (!proof && !activeSendStatus) {
      const message =
        "Run a successful test send before starting a full list send.";
      setSendNotice(message);
      showToast("error", "Test send required", message);
      return;
    }

    setBusy("start-send");
    setSendNotice("Sending...");
    showToast(
      "loading",
      "Sending list",
      activeSendStatus
        ? "Resuming from the last durable recipient checkpoint."
        : "Starting the first server-throttled send window.",
    );
    try {
      let status: DirectSendStatus | null = null;
      const runId = activeSendStatus?.runId ?? crypto.randomUUID();
      let cursor = activeSendStatus?.nextCursor ?? 0;

      if (!activeSendStatus) {
        commitSendStatus({
          runId,
          proofKey: currentTestProofKey,
          totalRecipients: recipientResult?.emails.length ?? 0,
          sentCount: 0,
          failedCount: 0,
          pendingCount: recipientResult?.emails.length ?? 0,
          sendingCount: 0,
          leaseActive: false,
          leaseExpiresAt: null,
          nextCursor: cursor,
          complete: false,
          interrupted: false,
          invalid: recipientResult?.invalid ?? [],
          duplicateCount: recipientResult?.duplicateCount ?? 0,
          columns: recipientResult?.columns,
          unverifiedRecipients: [],
          recentFailures: [],
        });
      }

      for (let batch = 0; batch < 1000; batch += 1) {
        status = await sendDirectBatchAction({
          runId,
          template,
          recipients: recipientText,
          testSendToken: proof?.token,
          cursor,
        });
        commitSendStatus({ ...status, proofKey: currentTestProofKey });
        showToast(
          "loading",
          "Sending list",
          `${status.sentCount} sent, ${status.failedCount} failed, ${status.pendingCount} pending${
            status.sendingCount ? `, ${status.sendingCount} sending` : ""
          }.`,
        );
        cursor = status.nextCursor;

        if (status.complete) {
          break;
        }

        if (status.interrupted) {
          break;
        }

        if (status.leaseActive || status.sendingCount > 0) {
          break;
        }
      }

      setSendNotice(
        status
          ? status.complete
            ? `Send complete: ${status.sentCount} sent, ${status.failedCount} failed.`
            : status.interrupted
              ? "One delivery was interrupted after it started. Verify it in SES, then resolve it without automatically resending."
              : status.leaseActive && status.leaseExpiresAt
                ? `Waiting for the previous send request to expire at ${formatTime(status.leaseExpiresAt)}. Recovery will refresh automatically.`
                : "Send paused. Continue when ready."
          : "Send complete.",
      );
      showToast(
        status?.complete && !status.failedCount
          ? "success"
          : status?.interrupted
            ? "error"
            : "info",
        status?.complete ? "List send complete" : "List send paused",
        status
          ? status.complete
            ? `${status.sentCount} sent, ${status.failedCount} failed.`
            : status.interrupted
              ? "Verify the interrupted delivery in SES before resolving it."
              : status.leaseActive && status.leaseExpiresAt
                ? `Recovery becomes available at ${formatTime(status.leaseExpiresAt)}.`
                : "The saved send is ready to continue."
          : "Send complete.",
      );

      if (status?.complete) {
        clearCompletedSend();
      }
    } catch (error) {
      const message = errorMessage(error);
      setSendNotice(message);
      showToast("error", "List send failed", message);
    } finally {
      setBusy(null);
    }
  }

  function commitSendStatus(status: DirectSendStatus) {
    setSendStatus(status);
    storeSendStatus(status);
  }

  function clearSendStatus() {
    setSendStatus(null);
    removeStoredSendStatus();
  }

  function clearCompletedSend() {
    setRecipientText("");
    setRecipientResult(null);
    setAudienceLabel("");
    removeStoredSendRecipients();
    removeStoredSendStatus();
  }

  async function resolveInterruptedDelivery() {
    const template = buildDirectSendTemplate(selectedTemplate, theme);
    const status = activeSendStatus;

    if (!template || !status || !status.interrupted) {
      const message =
        "Select the original template and keep the recipient list loaded before resolving this delivery.";
      setSendNotice(message);
      showToast("error", "Cannot resolve delivery", message);
      return;
    }

    setBusy("start-send");
    setSendNotice("Resolving interrupted delivery...");
    try {
      const nextStatus = await sendDirectBatchAction({
        runId: status.runId,
        template,
        recipients: recipientText,
        cursor: status.nextCursor,
        resolveInterrupted: true,
      });

      commitSendStatus({ ...nextStatus, proofKey: currentTestProofKey });
      if (nextStatus.complete) {
        clearCompletedSend();
        setSendNotice(
          `Send complete: ${nextStatus.sentCount} sent, ${nextStatus.failedCount} failed.`,
        );
        showToast(
          nextStatus.failedCount ? "error" : "success",
          "List send complete",
          `${nextStatus.sentCount} sent, ${nextStatus.failedCount} failed.`,
        );
      } else {
        setSendNotice(
          "Interrupted delivery resolved. Continue the send when ready.",
        );
        showToast("info", "Delivery resolved", "The run can continue now.");
      }
    } catch (error) {
      const message = errorMessage(error);
      setSendNotice(message);
      showToast("error", "Resolve failed", message);
    } finally {
      setBusy(null);
    }
  }

  function commitTestSendProof(proof: TestSendProof) {
    setTestSendProof(proof);
    storeTestSendProof(proof);
  }

  function clearTestSendProof() {
    setTestSendProof(null);
    removeStoredTestSendProof();
  }

  function selectTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    clearSendStatus();
  }

  function updateTheme(nextTheme: EmailThemeTokens) {
    setTheme(nextTheme);
    clearSendStatus();
  }

  function changeSurface(nextSurface: EmailCampaignSurface) {
    setSurface(nextSurface);

    const url = new URL(window.location.href);
    if (nextSurface === "builder") {
      url.searchParams.delete("view");
    } else {
      url.searchParams.set("view", nextSurface);
    }
    window.history.pushState(null, "", `${url.pathname}${url.search}`);
  }

  function showToast(tone: ToastTone, title: string, description?: string) {
    toastIdRef.current += 1;
    setToast({
      id: toastIdRef.current,
      tone,
      title,
      description,
    });
  }

  useEffect(() => {
    function handlePopState() {
      setSurface(parseEmailCampaignSurface(window.location.search));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const localTheme = loadStoredTheme();

      if (localTheme) {
        setTheme(localTheme);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (selectedTemplate) {
        void renderPreview(selectedTemplate, theme, effectiveMergePreviewData);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [selectedTemplate, theme, effectiveMergePreviewData]);

  useEffect(() => {
    if (!toast || toast.tone === "loading") {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const leaseExpiresAt = activeSendStatus?.leaseExpiresAt;
    const template = buildDirectSendTemplate(selectedTemplate, theme);

    if (
      !activeSendStatus?.leaseActive ||
      !leaseExpiresAt ||
      !template ||
      !recipientText.trim()
    ) {
      return;
    }

    const refreshDelay = Math.max(
      0,
      Date.parse(leaseExpiresAt) - Date.now() + 250,
    );
    const timer = window.setTimeout(() => {
      void findActiveDirectSendAction({
        template,
        recipients: recipientText,
      })
        .then((recoveredStatus) => {
          if (!recoveredStatus) {
            return;
          }

          const nextStatus = {
            ...recoveredStatus,
            proofKey: currentTestProofKey,
          };
          setSendStatus(nextStatus);
          storeSendStatus(nextStatus);
          setSendNotice(
            recoveredStatus.interrupted
              ? "A delivery was interrupted after it started. Verify it before resolving."
              : "Recovery window expired. The saved send is ready to continue.",
          );
        })
        .catch((error) => {
          setSendNotice(errorMessage(error));
        });
    }, refreshDelay);

    return () => window.clearTimeout(timer);
  }, [
    activeSendStatus?.leaseActive,
    activeSendStatus?.leaseExpiresAt,
    currentTestProofKey,
    recipientText,
    selectedTemplate,
    theme,
  ]);

  const previewWidth = previewMode === "desktop" ? 720 : 390;
  const showTemplatesRail = panelsMounted && templatesPanelCollapsed;

  const templatesListBody = showTemplatesRail ? (
    <div className="flex h-full flex-col items-center py-3">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Expand templates panel"
        aria-label="Expand templates panel"
        onClick={() => {
          setTemplatesPanelCollapsed(false);
          templatesPanelRef.current?.expand();
        }}
      >
        <PanelLeftOpen />
      </Button>
      <FileText className="mt-3 size-4 text-moss dark:text-sage" />
    </div>
  ) : (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-2">
          {panelsMounted ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              title="Collapse templates panel"
              aria-label="Collapse templates panel"
              onClick={() => {
                setTemplatesPanelCollapsed(true);
                templatesPanelRef.current?.collapse();
              }}
            >
              <PanelLeftClose />
            </Button>
          ) : null}
          <FileText className="size-4 shrink-0 text-moss dark:text-sage" />
          <h2 className="truncate text-sm font-semibold">Templates</h2>
        </div>
        <Badge variant="outline">{templates.length}</Badge>
      </div>
      <div className="shrink-0 space-y-2 border-b p-3">
        <input
          ref={uploadRef}
          type="file"
          accept=".html,text/html"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadHtmlTemplate(file);
          }}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            title="New template"
            onClick={createStructuredTemplate}
          >
            <Plus />
            New
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => uploadRef.current?.click()}
            disabled={busy === "upload"}
          >
            <Upload />
            Upload
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {templates.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No templates yet.
          </div>
        ) : (
          <div className="divide-y">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  selectTemplate(template.id);
                }}
                className={cn(
                  "block w-full px-4 py-3 text-left transition-colors hover:bg-muted/60",
                  selectedTemplateId === template.id &&
                    "bg-muted hover:bg-muted",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold">
                    {template.name}
                  </p>
                  <Badge variant="outline" className="shrink-0 uppercase">
                    {template.type}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {template.description || template.subject}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );

  const workspaceBody =
    surface === "builder" ? (
      <BuilderPanel
        notice={notice}
        selectedTemplate={selectedTemplate}
        onDownloadTemplate={downloadSelectedTemplate}
        onDeleteTemplate={deleteSelectedTemplate}
        aiDraftText={aiDraftText}
        aiDescription={aiDescription}
        generateBusy={busy === "generate-ai-draft"}
        onAiDraftTextChange={setAiDraftText}
        onAiDescriptionChange={setAiDescription}
        onCopyAiContext={() => void copyAiTemplateContext()}
        onGenerateAiDraft={() => void generateAiTemplateDraft()}
        onImportAiDraft={importAiTemplateDraft}
        onTemplateChange={updateSelectedTemplate}
        onContentChange={updateContent}
        onSectionChange={updateSection}
        onSectionAdd={addSection}
        onSectionRemove={removeSection}
        onSectionMove={moveSection}
      />
    ) : surface === "styles" ? (
      <StylesPanel theme={theme} onThemeChange={updateTheme} />
    ) : (
      <SendPanel
        selectedTemplate={selectedTemplate}
        mergeFields={mergeFields}
        limits={campaignLimits}
        recipientSource={recipientSource}
        recipientText={recipientText}
        recipientResult={recipientResult}
        audienceQuery={audienceQuery}
        audienceLabel={audienceLabel}
        sendOneEmail={sendOneEmail}
        testEmails={testEmails}
        sendStatus={activeSendStatus}
        testSendProof={activeTestSendProof}
        notice={sendNotice}
        busy={busy}
        onRecipientSourceChange={changeRecipientSource}
        onRecipientTextChange={(value) => {
          setRecipientText(value);
          storeSendRecipients(value);
          setRecipientResult(null);
          setAudienceLabel("");
          clearSendStatus();
        }}
        onAudienceQueryChange={updateAudienceQuery}
        onLoadAudience={() => void loadAudienceRecipients()}
        onCheckRecipients={() => void checkRecipientList()}
        onSendOneEmailChange={setSendOneEmail}
        onSendOne={() => void sendOneRecipient()}
        onTestSend={() => void sendTestEmails()}
        onStartSend={() => void startFullSend()}
        onResolveInterrupted={() => void resolveInterruptedDelivery()}
      />
    );

  const workspaceChrome = (
    <>
      <EmailCampaignWorkspaceHeader
        activeView={surface}
        onViewChange={changeSurface}
        onSave={handleWorkspaceSave}
        busy={busy}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{workspaceBody}</div>
    </>
  );

  const previewBody = (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Preview</h2>
        <div className="inline-flex items-center gap-1 rounded-md border bg-muted p-1">
          <PreviewButton
            active={previewMode === "desktop"}
            onClick={() => setPreviewMode("desktop")}
            label="Desktop"
          >
            <Laptop />
          </PreviewButton>
          <PreviewButton
            active={previewMode === "mobile"}
            onClick={() => setPreviewMode("mobile")}
            label="Mobile"
          >
            <Smartphone />
          </PreviewButton>
        </div>
      </div>
      <PreviewMergePanel
        fields={mergeFields}
        values={effectiveMergePreviewData}
        onChange={(field, value) =>
          setMergePreviewData((current) => ({
            ...current,
            [field]: value,
          }))
        }
      />
      <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/30 p-4">
        <div
          className="mx-auto overflow-hidden rounded-md bg-card "
          style={{ width: previewWidth, maxWidth: "100%" }}
        >
          {previewHtml ? (
            <iframe
              title="Email preview"
              srcDoc={previewHtml}
              sandbox=""
              className="h-[760px] w-full border-0"
            />
          ) : (
            <div className="flex h-[520px] items-center justify-center text-sm text-muted-foreground">
              Select a template to preview.
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <main className="h-dvh overflow-hidden bg-background text-foreground">
      <div className="flex h-full flex-col font-red-hat">
        <AdminPageHeader
          title="Email Campaigns"
          description="Build reusable templates, preview merge fields, and send CSV-based emails."
          variant="workspace"
        />
        {panelsMounted ? (
          <div className="hidden min-h-0 flex-1 overflow-hidden border-t bg-card lg:flex">
            <ResizablePanelGroup
              id="email-campaign-workspace"
              orientation="horizontal"
              defaultLayout={panelLayout.defaultLayout}
              onLayoutChanged={panelLayout.onLayoutChanged}
              resizeTargetMinimumSize={{ coarse: 32, fine: 16 }}
              className="min-h-0 flex-1 overflow-hidden"
            >
              <ResizablePanel
                id="templates-list"
                defaultSize={300}
                minSize={220}
                maxSize={480}
                collapsible
                collapsedSize="40px"
                panelRef={templatesPanelRef}
                onResize={(size) => {
                  setTemplatesPanelCollapsed(size.inPixels <= 48);
                }}
                className="min-h-0 min-w-0"
              >
                <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r bg-card">
                  {templatesListBody}
                </aside>
              </ResizablePanel>

              <ResizablePanel
                id="campaign-workspace"
                minSize={480}
                className="min-h-0 min-w-0"
              >
                <section className="flex h-full min-h-0 min-w-[30rem] flex-col overflow-hidden border-r bg-muted/30">
                  {workspaceChrome}
                </section>
              </ResizablePanel>

              <ResizablePanel
                id="preview"
                defaultSize={420}
                minSize={300}
                className="min-h-0 min-w-0"
              >
                <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-4">
                  {previewBody}
                </section>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        ) : (
          <div className="hidden min-h-0 flex-1 overflow-hidden border-t bg-card lg:grid lg:grid-cols-[300px_minmax(30rem,1fr)_420px]">
            <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r bg-card">
              {templatesListBody}
            </aside>
            <section className="flex h-full min-h-0 min-w-[30rem] flex-col overflow-hidden border-r bg-muted/30">
              {workspaceChrome}
            </section>
            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden p-4">
              {previewBody}
            </section>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto border-t bg-card lg:hidden">
          <aside className="flex flex-col overflow-hidden border-b bg-card">
            {templatesListBody}
          </aside>
          <section className="flex min-w-[30rem] flex-col overflow-hidden border-b bg-muted/30">
            {workspaceChrome}
          </section>
          <section className="flex flex-col overflow-hidden p-4">
            {previewBody}
          </section>
        </div>
        <ToastSnackbar toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </main>
  );
}

function EmailCampaignViewNav({
  activeView,
  onViewChange,
}: {
  activeView: EmailCampaignSurface;
  onViewChange: (view: EmailCampaignSurface) => void;
}) {
  return (
    <nav
      aria-label="Email campaign workspace"
      className="flex shrink-0 flex-nowrap items-center gap-2"
    >
      {emailCampaignViews.map(({ value, label, icon: Icon }) => {
        const active = activeView === value;

        return (
          <Button
            key={value}
            type="button"
            variant={active ? "default" : "outline"}
            size="sm"
            className={cn(!active && "bg-card text-muted-foreground")}
            aria-current={active ? "page" : undefined}
            onClick={() => onViewChange(value)}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        );
      })}
    </nav>
  );
}

function EmailCampaignWorkspaceHeader({
  activeView,
  onViewChange,
  onSave,
  busy,
}: {
  activeView: EmailCampaignSurface;
  onViewChange: (view: EmailCampaignSurface) => void;
  onSave: () => void;
  busy: string | null;
}) {
  const saveLabel = activeView === "styles" ? "Save styles" : "Save to master";
  const saveBusy =
    activeView === "styles" ? busy === "save-styles" : busy === "save-template";

  return (
    <div className="flex h-14 shrink-0 flex-nowrap items-center justify-between gap-3 border-b bg-card px-4">
      <EmailCampaignViewNav
        activeView={activeView}
        onViewChange={onViewChange}
      />
      <Button
        className={cn(adminPrimaryButtonClass, "shrink-0")}
        onClick={onSave}
        disabled={saveBusy}
      >
        <Save />
        {saveLabel}
      </Button>
    </div>
  );
}

function BodyBlockCard({
  index,
  total,
  section,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  section: EmailCampaignContent["sections"][number];
  onChange: (patch: Partial<EmailCampaignContent["sections"][number]>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const blockLabel = section.title?.trim() || `Block ${index + 1}`;

  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className="flex items-center gap-2">
        <InlineEditableField
          className="text-sm font-medium text-foreground"
          wrapperClassName="min-w-0 flex-1"
          value={section.title ?? ""}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder={`Block ${index + 1}`}
          aria-label={`Title for block ${index + 1}`}
        />
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className={adminMiniButtonClass}
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`Move ${blockLabel} up`}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className={adminMiniButtonClass}
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label={`Move ${blockLabel} down`}
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className={adminMiniButtonClass}
            onClick={onRemove}
            aria-label={`Remove ${blockLabel}`}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <textarea
        className={`${textareaClass} mt-3`}
        rows={6}
        value={section.body}
        onChange={(event) => onChange({ body: event.target.value })}
        placeholder="Body copy"
        aria-label={`Body copy for ${blockLabel}`}
      />
    </div>
  );
}

function BuilderPanel({
  notice,
  selectedTemplate,
  onDownloadTemplate,
  onDeleteTemplate,
  aiDraftText,
  aiDescription,
  generateBusy,
  onAiDraftTextChange,
  onAiDescriptionChange,
  onCopyAiContext,
  onGenerateAiDraft,
  onImportAiDraft,
  onTemplateChange,
  onContentChange,
  onSectionChange,
  onSectionAdd,
  onSectionRemove,
  onSectionMove,
}: {
  notice: string;
  selectedTemplate: MasterTemplate | null;
  onDownloadTemplate: () => void;
  onDeleteTemplate: () => void;
  aiDraftText: string;
  aiDescription: string;
  generateBusy: boolean;
  onAiDraftTextChange: (value: string) => void;
  onAiDescriptionChange: (value: string) => void;
  onCopyAiContext: () => void;
  onGenerateAiDraft: () => void;
  onImportAiDraft: () => void;
  onTemplateChange: (patch: Partial<MasterTemplate>) => void;
  onContentChange: (patch: Partial<EmailCampaignContent>) => void;
  onSectionChange: (
    index: number,
    patch: Partial<EmailCampaignContent["sections"][number]>,
  ) => void;
  onSectionAdd: () => void;
  onSectionRemove: (index: number) => void;
  onSectionMove: (index: number, direction: -1 | 1) => void;
}) {
  if (!selectedTemplate) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-card text-sm text-muted-foreground">
        Choose or create a master template.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <InlineEditableField
            className="text-lg font-semibold text-foreground"
            wrapperClassName="min-w-0 flex-1"
            value={selectedTemplate.name}
            onChange={(event) => onTemplateChange({ name: event.target.value })}
            placeholder="Template name"
            aria-label="Template name"
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className={adminMiniButtonClass}
            onClick={onDownloadTemplate}
            aria-label="Download template"
          >
            <Download />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className={adminMiniButtonClass}
            onClick={onDeleteTemplate}
            aria-label="Remove template"
          >
            <Trash2 />
          </Button>
        </div>
        <InlineEditableField
          className="text-sm text-muted-foreground"
          wrapperClassName="mt-1.5 max-w-full"
          value={selectedTemplate.description}
          onChange={(event) =>
            onTemplateChange({ description: event.target.value })
          }
          placeholder="Description"
          aria-label="Description"
        />
      </div>

      {notice ? (
        <p className="text-sm text-muted-foreground">{notice}</p>
      ) : null}

      <div className="space-y-3">
        <Field label="Subject">
          <input
            className={inputClass}
            value={selectedTemplate.subject}
            onChange={(event) =>
              onTemplateChange({ subject: event.target.value })
            }
          />
        </Field>
        <Field label="Preview text">
          <input
            className={inputClass}
            value={selectedTemplate.previewText}
            onChange={(event) =>
              onTemplateChange({ previewText: event.target.value })
            }
          />
        </Field>
      </div>

      {selectedTemplate.type === "html" ? (
        <EditorSection title="HTML body">
          <textarea
            className={`${textareaClass} text-xs`}
            rows={18}
            value={selectedTemplate.html ?? ""}
            onChange={(event) => onTemplateChange({ html: event.target.value })}
          />
        </EditorSection>
      ) : selectedTemplate.content ? (
        <>
          <EditorSection title="Header">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Eyebrow">
                <input
                  className={inputClass}
                  value={selectedTemplate.content.eyebrow ?? ""}
                  onChange={(event) =>
                    onContentChange({ eyebrow: event.target.value })
                  }
                />
              </Field>
              <Field label="Heading">
                <input
                  className={inputClass}
                  value={selectedTemplate.content.heading}
                  onChange={(event) =>
                    onContentChange({ heading: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Intro">
              <textarea
                className={textareaClass}
                rows={2}
                value={selectedTemplate.content.intro ?? ""}
                onChange={(event) =>
                  onContentChange({ intro: event.target.value })
                }
              />
            </Field>
          </EditorSection>

          <EditorSection
            title="Body blocks"
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={adminSecondaryButtonClass}
                onClick={onSectionAdd}
              >
                <Plus />
                Add block
              </Button>
            }
          >
            {selectedTemplate.content.sections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No body blocks yet.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedTemplate.content.sections.map((section, index) => (
                  <BodyBlockCard
                    key={section.id}
                    index={index}
                    total={selectedTemplate.content!.sections.length}
                    section={section}
                    onChange={(patch) => onSectionChange(index, patch)}
                    onMove={(direction) => onSectionMove(index, direction)}
                    onRemove={() => onSectionRemove(index)}
                  />
                ))}
              </div>
            )}
          </EditorSection>

          <EditorSection title="Footer">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Button label">
                <input
                  className={inputClass}
                  value={selectedTemplate.content.cta?.label ?? ""}
                  onChange={(event) =>
                    onContentChange({
                      cta: {
                        label: event.target.value,
                        url:
                          selectedTemplate.content?.cta?.url ??
                          "https://mhacks.org",
                      },
                    })
                  }
                  placeholder="Open dashboard"
                />
              </Field>
              <Field label="Button URL">
                <input
                  className={inputClass}
                  value={selectedTemplate.content.cta?.url ?? ""}
                  onChange={(event) =>
                    onContentChange({
                      cta: {
                        label:
                          selectedTemplate.content?.cta?.label ?? "Learn more",
                        url: event.target.value,
                      },
                    })
                  }
                  placeholder="https://mhacks.org"
                />
              </Field>
            </div>
            <Field label="Footer note">
              <textarea
                className={textareaClass}
                rows={2}
                value={selectedTemplate.content.footerNote ?? ""}
                onChange={(event) =>
                  onContentChange({ footerNote: event.target.value })
                }
                placeholder="Questions? Reply to this email or contact the MHacks team."
              />
            </Field>
          </EditorSection>
        </>
      ) : null}

      <Accordion
        type="single"
        collapsible
        className="border-t border-border pt-1"
      >
        <AccordionItem value="ai">
          <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
            AI drafting
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <AiDraftPanel
              draftText={aiDraftText}
              templateType={selectedTemplate.type}
              aiDescription={aiDescription}
              generateBusy={generateBusy}
              onAiDescriptionChange={onAiDescriptionChange}
              onCopyAiContext={onCopyAiContext}
              onDraftTextChange={onAiDraftTextChange}
              onGenerateDraft={onGenerateAiDraft}
              onImportDraft={onImportAiDraft}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function AiDraftPanel({
  draftText,
  templateType,
  aiDescription,
  generateBusy,
  onAiDescriptionChange,
  onCopyAiContext,
  onDraftTextChange,
  onGenerateDraft,
  onImportDraft,
}: {
  draftText: string;
  templateType: TemplateType;
  aiDescription: string;
  generateBusy: boolean;
  onAiDescriptionChange: (value: string) => void;
  onCopyAiContext: () => void;
  onDraftTextChange: (value: string) => void;
  onGenerateDraft: () => void;
  onImportDraft: () => void;
}) {
  return (
    <div>
      <Tabs defaultValue="generate">
        <TabsList variant="line">
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="manual">Manual prompt</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-4 space-y-3">
          <Field label="What to generate">
            <textarea
              className={textareaClass}
              rows={4}
              value={aiDescription}
              onChange={(event) => onAiDescriptionChange(event.target.value)}
              placeholder="Example: A short RSVP reminder for accepted hackers. Friendly tone, mention the Friday deadline, and link to the dashboard."
            />
          </Field>
          <div className="flex justify-end">
            <Button
              type="button"
              className={adminPrimaryButtonClass}
              disabled={generateBusy || !aiDescription.trim()}
              onClick={onGenerateDraft}
            >
              <Sparkles />
              Generate draft
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="mt-4 space-y-3">
          <Button
            type="button"
            variant="ghost"
            className={adminSecondaryButtonClass}
            onClick={onCopyAiContext}
          >
            <Copy />
            Copy AI context
          </Button>
        </TabsContent>
      </Tabs>

      <Field label="Draft JSON">
        <div className="relative">
          {generateBusy ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md border border-border bg-background/85">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Generating draft…
              </div>
            </div>
          ) : null}
          <textarea
            className={cn(textareaClass, "min-h-32 text-xs")}
            value={draftText}
            disabled={generateBusy}
            onChange={(event) => onDraftTextChange(event.target.value)}
            placeholder={
              templateType === "html"
                ? '{ "subject": "...", "previewText": "...", "html": "<p>...</p>" }'
                : '{ "subject": "...", "previewText": "...", "content": { "heading": "...", "sections": [...] } }'
            }
          />
        </div>
      </Field>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          className={adminPrimaryButtonClass}
          disabled={!draftText.trim()}
          onClick={onImportDraft}
        >
          <Sparkles />
          Import draft
        </Button>
      </div>
    </div>
  );
}

function PreviewMergePanel({
  fields,
  values,
  onChange,
}: {
  fields: string[];
  values: Record<string, string>;
  onChange: (field: string, value: string) => void;
}) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <Accordion type="single" collapsible className="mt-3">
      <AccordionItem
        value="merge"
        className="rounded-md border border-border px-3"
      >
        <AccordionTrigger className="py-2.5 text-sm font-medium hover:no-underline">
          Sample recipient
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            · {fields.length} {fields.length === 1 ? "field" : "fields"}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((field) => (
              <label key={field} className="block space-y-1">
                <span className="text-xs text-muted-foreground">{field}</span>
                <input
                  aria-label={`Sample value for ${field}`}
                  className={inputClass}
                  value={values[field] ?? ""}
                  placeholder={defaultMergeValue(field)}
                  onChange={(event) => onChange(field, event.target.value)}
                />
              </label>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function SendPanel({
  selectedTemplate,
  mergeFields,
  limits,
  recipientSource,
  recipientText,
  recipientResult,
  audienceQuery,
  audienceLabel,
  sendOneEmail,
  testEmails,
  sendStatus,
  testSendProof,
  notice,
  busy,
  onRecipientSourceChange,
  onRecipientTextChange,
  onAudienceQueryChange,
  onLoadAudience,
  onCheckRecipients,
  onSendOneEmailChange,
  onSendOne,
  onTestSend,
  onStartSend,
  onResolveInterrupted,
}: {
  selectedTemplate: MasterTemplate | null;
  mergeFields: string[];
  limits: CampaignLimits;
  recipientSource: RecipientSource;
  recipientText: string;
  recipientResult: RecipientSaveResult | null;
  audienceQuery: EmailAudienceQuery;
  audienceLabel: string;
  sendOneEmail: string;
  testEmails: string;
  sendStatus: DirectSendStatus | null;
  testSendProof: TestSendProof | null;
  notice: string;
  busy: string | null;
  onRecipientSourceChange: (source: RecipientSource) => void;
  onRecipientTextChange: (value: string) => void;
  onAudienceQueryChange: (patch: Partial<EmailAudienceQuery>) => void;
  onLoadAudience: () => void;
  onCheckRecipients: () => void;
  onSendOneEmailChange: (value: string) => void;
  onSendOne: () => void;
  onTestSend: () => void;
  onStartSend: () => void;
  onResolveInterrupted: () => void;
}) {
  const sendRate = Math.floor(1000 / Math.max(1, limits.sendDelayMs));
  const templateCanSend = Boolean(
    selectedTemplate &&
    (selectedTemplate.type === "html" || selectedTemplate.content),
  );
  const validatedRecipients = recipientResult?.emails.length ?? 0;
  const requiredRecipientColumns = mergeFields.filter(
    (field) => !builtInRecipientMergeFields.has(field),
  );
  const recipientColumns = new Set(recipientResult?.columns ?? []);
  const missingRecipientColumns = recipientResult
    ? requiredRecipientColumns.filter((field) => !recipientColumns.has(field))
    : [];
  const fullSendUnlocked = Boolean(testSendProof || sendStatus);
  const recipientInputDisabled =
    !fullSendUnlocked || Boolean(busy) || recipientSource === "audience";
  const fullSendReady = Boolean(
    templateCanSend &&
    (testSendProof || sendStatus) &&
    recipientText.trim() &&
    recipientResult &&
    recipientResult.emails.length > 0 &&
    recipientResult.invalid.length === 0 &&
    missingRecipientColumns.length === 0,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Direct send
          </p>
          <h2 className="text-lg font-semibold text-foreground">Send email</h2>
          {notice ? (
            <p className="mt-1 text-sm text-muted-foreground">{notice}</p>
          ) : null}
        </div>
      </div>

      {!templateCanSend ? (
        <p className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          Select a template with content before sending.
        </p>
      ) : null}

      <SendProgress busy={busy} sendStatus={sendStatus} />

      <section className={cn(adminInsetClass, "p-4")}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Selected template
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {selectedTemplate?.name ?? "No template selected"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedTemplate?.type === "html"
                ? "HTML template"
                : "Structured template"}
            </p>
          </div>
          <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Server limits
            </p>
            <p className="mt-1 text-foreground">
              {limits.maxRecipients} max recipients
            </p>
            <p className="text-xs text-muted-foreground">
              {limits.batchSize}/batch, about {sendRate}/sec
              {limits.maxSendRatePerSecond
                ? ` max ${limits.maxSendRatePerSecond}/sec`
                : ""}
            </p>
          </div>
        </div>

        {sendStatus ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Metric
              label="Status"
              value={
                sendStatus.complete
                  ? "complete"
                  : sendStatus.interrupted
                    ? "interrupted"
                    : sendStatus.leaseActive
                      ? "recovering"
                      : busy === "start-send"
                        ? "sending"
                        : "ready"
              }
            />
            <Metric label="Recipients" value={sendStatus.totalRecipients} />
            <Metric label="Sent" value={sendStatus.sentCount} />
            <Metric label="Failed" value={sendStatus.failedCount} />
            {sendStatus.sendingCount ? (
              <Metric label="Sending" value={sendStatus.sendingCount} />
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={cn(adminInsetClass, "p-4")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recipients
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Paste a list manually or load a Supabase group as CSV. Group rows
              include <code className={codeClass}>email</code>,{" "}
              <code className={codeClass}>first_name</code>, decision, RSVP, and
              travel reimbursement columns.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={recipientSource === "manual" ? "default" : "ghost"}
              className={
                recipientSource === "manual"
                  ? adminPrimaryButtonClass
                  : adminSecondaryButtonClass
              }
              onClick={() => onRecipientSourceChange("manual")}
              disabled={Boolean(busy)}
            >
              <Users />
              Manual
            </Button>
            <Button
              type="button"
              variant={recipientSource === "audience" ? "default" : "ghost"}
              className={
                recipientSource === "audience"
                  ? adminPrimaryButtonClass
                  : adminSecondaryButtonClass
              }
              onClick={() => onRecipientSourceChange("audience")}
              disabled={Boolean(busy)}
            >
              <Database />
              Groups
            </Button>
          </div>
        </div>
        {recipientSource === "audience" ? (
          <div className="mt-4 rounded-md border border-border bg-card p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Filter className="size-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">
                  Audience query
                </p>
              </div>
              <Button
                variant="ghost"
                className={adminSecondaryButtonClass}
                disabled={!fullSendUnlocked || Boolean(busy)}
                onClick={onLoadAudience}
              >
                <Database />
                {busy === "load-audience" ? "Loading..." : "Load group"}
              </Button>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <Field label="Decision group">
                <select
                  className={inputClass}
                  value={audienceQuery.decisionGroup}
                  disabled={Boolean(busy)}
                  onChange={(event) => {
                    const decisionGroup = event.target
                      .value as EmailAudienceQuery["decisionGroup"];

                    onAudienceQueryChange(
                      decisionGroup === "draft" || decisionGroup === "umich"
                        ? {
                            decisionGroup,
                            travelAward: "any",
                            rsvpTravelPlan: "any",
                          }
                        : { decisionGroup },
                    );
                  }}
                >
                  {audienceDecisionOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Travel award">
                <select
                  className={inputClass}
                  value={audienceQuery.travelAward}
                  disabled={
                    Boolean(busy) ||
                    audienceQuery.decisionGroup === "draft" ||
                    audienceQuery.decisionGroup === "umich"
                  }
                  onChange={(event) =>
                    onAudienceQueryChange({
                      travelAward: event.target
                        .value as EmailAudienceQuery["travelAward"],
                    })
                  }
                >
                  {audienceTravelAwardOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="RSVP travel plan">
                <select
                  className={inputClass}
                  value={audienceQuery.rsvpTravelPlan}
                  disabled={
                    Boolean(busy) ||
                    audienceQuery.decisionGroup === "draft" ||
                    audienceQuery.decisionGroup === "umich"
                  }
                  onChange={(event) =>
                    onAudienceQueryChange({
                      rsvpTravelPlan: event.target
                        .value as EmailAudienceQuery["rsvpTravelPlan"],
                    })
                  }
                >
                  {audienceRsvpTravelPlanOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {fullSendUnlocked
                ? audienceLabel
                  ? `Loaded: ${audienceLabel}.`
                  : "Load the group to snapshot its current recipients into the list below."
                : "Run the required test send before loading a group."}
            </p>
          </div>
        ) : (
          <div className="mt-4 flex justify-end">
            <Button
              variant="ghost"
              className={adminSecondaryButtonClass}
              disabled={recipientInputDisabled || !recipientText.trim()}
              onClick={onCheckRecipients}
            >
              <Users />
              {busy === "check-recipients" ? "Checking..." : "Check list"}
            </Button>
          </div>
        )}
        <textarea
          className={cn(
            textareaClass,
            "mt-3 min-h-36 text-xs disabled:cursor-not-allowed disabled:opacity-60",
          )}
          value={recipientText}
          disabled={recipientInputDisabled}
          onChange={(event) => onRecipientTextChange(event.target.value)}
          placeholder={
            fullSendUnlocked
              ? recipientSource === "audience"
                ? "Load a group to generate recipients from Supabase."
                : "email,name,travel_reimbursement\nhacker@umich.edu,Hacker,150.00"
              : "Run the required test send before adding recipients."
          }
        />
        {recipientResult ? (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <p className="rounded-md border border-border bg-card px-3 py-2">
              {recipientResult.emails.length} valid
            </p>
            <p className="rounded-md border border-border bg-card px-3 py-2">
              {recipientResult.duplicateCount} duplicates
            </p>
            <p className="rounded-md border border-border bg-card px-3 py-2">
              {recipientResult.invalid.length} invalid
            </p>
          </div>
        ) : null}
      </section>

      <section className={cn(adminInsetClass, "p-4")}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Send one
            </p>
            <div className="mt-2 flex gap-2">
              <input
                className={inputClass}
                type="email"
                value={sendOneEmail}
                onChange={(event) => onSendOneEmailChange(event.target.value)}
                placeholder="one@email.com"
              />
              <Button
                className={adminPrimaryButtonClass}
                disabled={!templateCanSend || !sendOneEmail || Boolean(busy)}
                onClick={onSendOne}
              >
                <Send />
                {busy === "send-one" ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Test send
            </p>
            <div className="mt-2 flex gap-2">
              <input
                className={cn(
                  inputClass,
                  "cursor-not-allowed bg-muted/40 text-muted-foreground",
                )}
                value={testEmails}
                readOnly
                placeholder={serverManagedTestListLabel}
              />
              <Button
                variant="ghost"
                className={adminSecondaryButtonClass}
                disabled={!templateCanSend || Boolean(busy)}
                onClick={onTestSend}
              >
                <ListChecks />
                {busy === "test-send" ? "Sending..." : "Test"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className={cn(adminInsetClass, "p-4")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Full list
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Unsent recipients are checkpointed for recovery; completed
              recipient rows are removed immediately. If the server or tab
              closes, check the same list to safely resume.
            </p>
            {sendStatus ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {sendStatus.pendingCount} pending, {sendStatus.sentCount} sent,{" "}
                {sendStatus.failedCount} failed
                {sendStatus.sendingCount
                  ? `, ${sendStatus.sendingCount} sending`
                  : ""}
                {sendStatus.leaseActive && sendStatus.leaseExpiresAt
                  ? `. Recovery available at ${formatTime(sendStatus.leaseExpiresAt)}`
                  : ""}
                {sendStatus.interrupted
                  ? ". Verify the interrupted delivery in SES before resolving it."
                  : ""}
              </p>
            ) : testSendProof ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Test passed: {testSendProof.sentCount}/
                {testSendProof.totalCount} sent. Full send unlocked until{" "}
                {formatTime(testSendProof.expiresAt)}.{" "}
                {recipientResult
                  ? recipientResult.invalid.length > 0
                    ? "Fix invalid recipients before sending."
                    : missingRecipientColumns.length > 0
                      ? `Missing columns: ${missingRecipientColumns.join(", ")}.`
                      : "Checked recipient list ready."
                  : "Check the recipient list to enable full send."}
              </p>
            ) : validatedRecipients > 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {validatedRecipients} checked recipients ready. Run a successful
                test send to unlock full send.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Run a successful test send before sending the full list.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className={adminPrimaryButtonClass}
              disabled={
                !fullSendReady ||
                Boolean(busy) ||
                sendStatus?.complete ||
                sendStatus?.interrupted ||
                sendStatus?.leaseActive
              }
              onClick={onStartSend}
            >
              <Play />
              {busy === "start-send"
                ? "Sending..."
                : sendStatus?.complete
                  ? "Complete"
                  : sendStatus?.leaseActive
                    ? "Waiting for recovery"
                    : "Start send"}
            </Button>
            {sendStatus?.interrupted ? (
              <Button
                variant="ghost"
                className={adminSecondaryButtonClass}
                disabled={Boolean(busy)}
                onClick={onResolveInterrupted}
              >
                <ListChecks />
                Resolve interrupted delivery
              </Button>
            ) : null}
          </div>
        </div>
        {sendStatus?.recentFailures.length ? (
          <div className="mt-4 space-y-2">
            {sendStatus.recentFailures.map((failure) => (
              <p
                key={`${failure.email}-${failure.error}`}
                className="rounded-md border border-red-200/60 bg-red-50 px-3 py-2 text-sm text-red-900"
              >
                {failure.email}: {failure.error || "Send failed"}
              </p>
            ))}
          </div>
        ) : null}
        {sendStatus?.interrupted && sendStatus.unverifiedRecipients.length ? (
          <div className="mt-4 rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Verify in SES before resolving:{" "}
            {sendStatus.unverifiedRecipients.join(", ")}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

function SendProgress({
  busy,
  sendStatus,
}: {
  busy: string | null;
  sendStatus: DirectSendStatus | null;
}) {
  if (!busy && !sendStatus) {
    return null;
  }

  const completed =
    sendStatus && sendStatus.totalRecipients > 0
      ? sendStatus.sentCount + sendStatus.failedCount
      : 0;
  const progress =
    sendStatus && sendStatus.totalRecipients > 0
      ? Math.round((completed / sendStatus.totalRecipients) * 100)
      : null;
  const title =
    busy === "check-recipients"
      ? "Checking recipient list"
      : busy === "load-audience"
        ? "Loading recipient group"
        : busy === "send-one"
          ? "Sending one email"
          : busy === "test-send"
            ? "Sending test email"
            : busy === "start-send"
              ? "Sending list"
              : sendStatus?.complete
                ? "Send complete"
                : sendStatus?.leaseActive
                  ? "Waiting for recovery"
                  : sendStatus?.interrupted
                    ? "Interrupted delivery"
                    : "Send progress";
  const detail = sendStatus
    ? `${sendStatus.sentCount} sent, ${sendStatus.failedCount} failed, ${sendStatus.pendingCount} pending${
        sendStatus.sendingCount ? `, ${sendStatus.sendingCount} sending` : ""
      }${
        sendStatus.leaseActive && sendStatus.leaseExpiresAt
          ? `; recovery available at ${formatTime(sendStatus.leaseExpiresAt)}`
          : ""
      }`
    : "Working on the server...";

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-muted/40 p-4 ">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {busy ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
          ) : (
            <CheckCircle2 className="size-4 shrink-0 text-primary" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {title}
            </p>
            <p className="truncate text-xs text-muted-foreground">{detail}</p>
          </div>
        </div>
        {progress !== null ? (
          <span className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            {progress}%
          </span>
        ) : null}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-md bg-muted">
        <div
          className={cn(
            "h-full rounded-md bg-primary transition-all duration-500",
            progress === null && "w-2/3 animate-pulse",
          )}
          style={progress !== null ? { width: `${progress}%` } : undefined}
        />
      </div>
    </section>
  );
}

function ToastSnackbar({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  if (!toast) {
    return null;
  }

  const Icon =
    toast.tone === "loading"
      ? Loader2
      : toast.tone === "success"
        ? CheckCircle2
        : toast.tone === "error"
          ? AlertTriangle
          : Send;
  const toneClass =
    toast.tone === "error"
      ? "border-red-500 bg-red-600 text-primary-foreground "
      : toast.tone === "success"
        ? "border-primary/40 bg-muted/40 text-foreground"
        : "border-border bg-card text-foreground";

  return (
    <div
      className={cn(
        "fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-lg border-2 p-4   md:left-auto md:right-5 md:mx-0",
        toneClass,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            "mt-0.5 size-5 shrink-0",
            toast.tone === "loading" && "animate-spin",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description ? (
            <p
              className={cn(
                "mt-1 text-sm leading-5",
                toast.tone !== "error" && "opacity-75",
              )}
            >
              {toast.description}
            </p>
          ) : null}
          {toast.tone === "loading" ? (
            <div className="mt-3 h-1.5 overflow-hidden rounded-md bg-muted">
              <div className="h-full w-2/3 animate-pulse rounded-md bg-current opacity-70" />
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-md p-1 opacity-75 transition hover:bg-muted hover:opacity-100"
          aria-label="Dismiss notification"
          onClick={onDismiss}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

function StylesPanel({
  theme,
  onThemeChange,
}: {
  theme: EmailThemeTokens;
  onThemeChange: (theme: EmailThemeTokens) => void;
}) {
  const colorFields: Array<[keyof EmailThemeTokens, string]> = [
    ["background", "Background"],
    ["backgroundAccent", "Accent"],
    ["border", "Border"],
    ["text", "Text"],
    ["muted", "Muted"],
    ["panel", "Panel"],
    ["pink", "Pink"],
    ["green", "Green"],
    ["ctaBackground", "CTA bg"],
    ["ctaColor", "CTA text"],
  ];
  const sizeFields: Array<[keyof EmailThemeTokens, string]> = [
    ["containerRadius", "Container radius"],
    ["containerBorderWidth", "Border width"],
    ["containerPadding", "Container padding"],
    ["headingSize", "Heading size"],
    ["bodySize", "Body size"],
    ["ctaRadius", "CTA radius"],
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Email styling
        </p>
        <h2 className="text-lg font-semibold text-foreground">Styles</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {colorFields.map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3  transition hover:border-primary/50"
          >
            <input
              type="color"
              value={String(theme[key])}
              onChange={(event) =>
                onThemeChange({ ...theme, [key]: event.target.value })
              }
              className="size-10 rounded-md border border-border bg-transparent"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {String(theme[key])}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sizeFields.map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              className={inputClass}
              value={String(theme[key])}
              onChange={(event) =>
                onThemeChange({ ...theme, [key]: event.target.value })
              }
            />
          </Field>
        ))}
      </div>
    </div>
  );
}

function PreviewButton({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`flex size-8 items-center justify-center rounded-sm border border-transparent transition-colors [&_svg]:size-4 ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function InlineEditableField({
  className,
  wrapperClassName,
  ...props
}: React.ComponentProps<"input"> & { wrapperClassName?: string }) {
  return (
    <div
      className={cn(
        "group/editable inline-flex max-w-full items-center gap-1",
        wrapperClassName,
      )}
    >
      <input
        className={cn(
          "min-w-[4ch] max-w-full border-0 border-b border-dotted border-transparent bg-transparent p-0 outline-none transition-[border-color] focus-visible:ring-0 placeholder:text-muted-foreground group-hover/editable:border-border/60 group-focus-within/editable:border-border/60 [field-sizing:content]",
          className,
        )}
        {...props}
      />
      <Pencil
        className="size-3 shrink-0 text-muted-foreground/35 transition-opacity group-hover/editable:text-muted-foreground/55 group-focus-within/editable:text-muted-foreground/55"
        aria-hidden
      />
    </div>
  );
}

function EditorSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

async function persistTemplate(template: MasterTemplate) {
  const payload = {
    name: template.name,
    type: template.type,
    description: template.description,
    subject: template.subject,
    previewText: template.previewText,
    content: template.content ?? undefined,
    html: template.html ?? undefined,
    status: template.status,
    sourceTemplateId: template.sourceTemplateId,
  };

  return saveEmailTemplateAction({
    templateId: isDraftTemplateId(template.id) ? undefined : template.id,
    template: payload,
  });
}

function isDraftTemplateId(templateId: string) {
  return templateId.startsWith("seed-") || templateId.startsWith("local-");
}

function parseEmailCampaignSurface(search: string): EmailCampaignSurface {
  const view = new URLSearchParams(search).get("view");

  if (view === "styles" || view === "send") {
    return view;
  }

  return "builder";
}

function parseAiTemplateDraft(
  rawDraft: string,
  template: MasterTemplate,
  currentMergeFields: string[],
): Partial<MasterTemplate> {
  const parsed = parseJsonObject(rawDraft);
  const draft = isRecord(parsed.template) ? parsed.template : parsed;
  const allowedMergeFields = new Set([
    ...Object.keys(defaultMergeSamples),
    ...currentMergeFields,
  ]);
  const next: Partial<MasterTemplate> = {};

  if (hasString(draft, "name")) {
    next.name = boundedString(draft.name, "Template name", 120);
  }

  if (hasString(draft, "description")) {
    next.description = boundedString(draft.description, "Description", 240);
  }

  if (hasString(draft, "subject")) {
    next.subject = boundedString(draft.subject, "Subject", 180, true);
  }

  if (hasString(draft, "previewText")) {
    next.previewText = boundedString(draft.previewText, "Preview text", 220);
  }

  if (template.type === "html") {
    if (!hasString(draft, "html")) {
      throw new Error("AI draft must include html for this template.");
    }

    assertSafeHtml(draft.html);
    assertAllowedMergeFields([draft.html], allowedMergeFields);
    next.html = draft.html;
    next.content = null;
    return next;
  }

  if (!isRecord(draft.content)) {
    throw new Error("AI draft must include content for this template.");
  }

  const content = parseAiContentDraft(draft.content, allowedMergeFields);
  next.content = content;
  next.html = null;
  return next;
}

function parseJsonObject(rawDraft: string): Record<string, unknown> {
  const trimmed = rawDraft.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Paste a JSON object from the AI draft.");
  }

  try {
    const parsed: unknown = JSON.parse(withoutFence.slice(start, end + 1));
    if (!isRecord(parsed)) {
      throw new Error("AI draft must be a JSON object.");
    }
    return parsed;
  } catch {
    throw new Error("AI draft JSON could not be parsed.");
  }
}

function parseAiContentDraft(
  draft: Record<string, unknown>,
  allowedMergeFields: Set<string>,
): EmailCampaignContent {
  if (!hasString(draft, "heading")) {
    throw new Error("AI draft content must include a heading.");
  }

  if (!Array.isArray(draft.sections)) {
    throw new Error("AI draft content must include a sections array.");
  }

  const sections = draft.sections.map((section, index) => {
    if (!isRecord(section) || !hasString(section, "body")) {
      throw new Error(`Section ${index + 1} must include body text.`);
    }

    const kind: EmailCampaignContent["sections"][number]["kind"] =
      section.kind === "code" || section.kind === "text"
        ? section.kind
        : undefined;

    return {
      id: hasString(section, "id") ? section.id : crypto.randomUUID(),
      kind,
      title: hasString(section, "title") ? section.title : undefined,
      body: boundedString(
        section.body,
        `Section ${index + 1} body`,
        4000,
        true,
      ),
    };
  });

  const content: EmailCampaignContent = {
    eyebrow: hasString(draft, "eyebrow")
      ? boundedString(draft.eyebrow, "Eyebrow", 80)
      : undefined,
    heading: boundedString(draft.heading, "Heading", 160, true),
    intro: hasString(draft, "intro")
      ? boundedString(draft.intro, "Intro", 1000)
      : undefined,
    sections,
    footerNote: hasString(draft, "footerNote")
      ? boundedString(draft.footerNote, "Footer note", 1000)
      : undefined,
  };

  if (isRecord(draft.cta)) {
    if (!hasString(draft.cta, "label") || !hasString(draft.cta, "url")) {
      throw new Error("CTA must include label and url.");
    }

    const ctaUrl = normalizeDraftUrl(
      boundedString(draft.cta.url, "CTA URL", 500, true),
    );
    assertEmailLinkUrl(ctaUrl);
    content.cta = {
      label: boundedString(draft.cta.label, "CTA label", 80, true),
      url: ctaUrl,
    };
  }

  assertAllowedMergeFields(contentStrings(content), allowedMergeFields);
  return content;
}

function assertAllowedMergeFields(
  values: string[],
  allowedMergeFields: Set<string>,
) {
  const fields = extractMergeFieldsFromValues(values);
  const unknown = fields.filter((field) => !allowedMergeFields.has(field));

  if (unknown.length > 0) {
    throw new Error(`Unknown merge fields: ${unknown.join(", ")}`);
  }
}

function contentStrings(content: EmailCampaignContent) {
  return [
    content.eyebrow ?? "",
    content.heading,
    content.intro ?? "",
    content.cta?.label ?? "",
    content.cta?.url ?? "",
    content.footerNote ?? "",
    ...content.sections.flatMap((section) => [
      section.title ?? "",
      section.body,
    ]),
  ];
}

function assertSafeHtml(html: string) {
  if (/<script\b/i.test(html) || /\son\w+=/i.test(html)) {
    throw new Error("HTML drafts cannot include scripts or event handlers.");
  }

  if (/javascript:/i.test(html)) {
    throw new Error("HTML drafts cannot include javascript URLs.");
  }
}

function normalizeDraftUrl(value: string) {
  const markdownLink = value.match(/^\[[^\]]+]\(([^)]+)\)$/);
  return markdownLink ? markdownLink[1].trim() : value;
}

function assertEmailLinkUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "mailto:"
    ) {
      return;
    }
  } catch {
    // handled below
  }

  throw new Error("CTA URL must use http, https, or mailto.");
}

function boundedString(
  value: string,
  label: string,
  maxLength: number,
  required = false,
) {
  const next = value.trim();

  if (required && !next) {
    throw new Error(`${label} is required.`);
  }

  if (next.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }

  return next;
}

function hasString(
  value: Record<string, unknown>,
  key: string,
): value is Record<string, unknown> & Record<typeof key, string> {
  return typeof value[key] === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadStoredTheme() {
  if (!canUseLocalStorage()) {
    return null;
  }

  if (
    window.localStorage.getItem(themeStorageVersionKey) !==
    currentThemeStorageVersion
  ) {
    window.localStorage.removeItem(themeStorageKey);
    return null;
  }

  return readStorage<EmailThemeTokens | null>(themeStorageKey, null);
}

function storeTheme(theme: EmailThemeTokens) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(
    themeStorageVersionKey,
    currentThemeStorageVersion,
  );
  window.localStorage.setItem(themeStorageKey, JSON.stringify(theme));
}

function loadStoredSendStatus() {
  const stored = readStorage<
    (DirectSendStatus & { staleBatchCursor?: number }) | null
  >(activeSendStatusStorageKey, null);

  return stored
    ? {
        ...stored,
        interrupted:
          stored.interrupted ?? stored.staleBatchCursor !== undefined,
        leaseActive: stored.leaseActive ?? false,
        leaseExpiresAt: stored.leaseExpiresAt ?? null,
        unverifiedRecipients: stored.unverifiedRecipients ?? [],
      }
    : null;
}

function storeSendStatus(status: DirectSendStatus) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(
    activeSendStatusStorageKey,
    JSON.stringify(status),
  );
}

function removeStoredSendStatus() {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(activeSendStatusStorageKey);
}

function loadStoredSendRecipients() {
  if (!canUseLocalStorage()) {
    return "";
  }

  return window.localStorage.getItem(activeSendRecipientsStorageKey) ?? "";
}

function storeSendRecipients(recipients: string) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(activeSendRecipientsStorageKey, recipients);
}

function removeStoredSendRecipients() {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(activeSendRecipientsStorageKey);
}

function loadStoredTestSendProof() {
  return readStorage<TestSendProof | null>(activeTestProofStorageKey, null);
}

function storeTestSendProof(proof: TestSendProof) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(activeTestProofStorageKey, JSON.stringify(proof));
}

function removeStoredTestSendProof() {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(activeTestProofStorageKey);
}

function extractMergeFields(template: MasterTemplate) {
  const values = [
    template.subject,
    template.previewText,
    template.html ?? "",
    template.content?.eyebrow ?? "",
    template.content?.heading ?? "",
    template.content?.intro ?? "",
    template.content?.cta?.label ?? "",
    template.content?.cta?.url ?? "",
    template.content?.footerNote ?? "",
    ...(template.content?.sections.flatMap((section) => [
      section.title ?? "",
      section.body,
    ]) ?? []),
  ];

  return extractMergeFieldsFromValues(values);
}

function extractMergeFieldsFromValues(values: string[]) {
  const fields = new Set<string>();
  const pattern = /{{\s*([\w.-]+)\s*}}/g;

  for (const value of values) {
    for (const match of value.matchAll(pattern)) {
      fields.add(match[1]);
    }
  }

  return Array.from(fields).sort((a, b) => a.localeCompare(b));
}

function ensureMergePreviewData(
  fields: string[],
  current: Record<string, string>,
) {
  const next: Record<string, string> = {};

  for (const field of fields) {
    next[field] = current[field] ?? defaultMergeValue(field);
  }

  return next;
}

const defaultMergeSamples: Record<string, string> = {
  email: "hacker@mhacks.org",
  expires_in: "10 minutes",
  first_name: "Hacker",
  last_name: "Hacker",
  name: "Hacker",
  otp_code: "123456",
  travel_reimbursement: "150.00",
};

function defaultMergeValue(field: string) {
  return defaultMergeSamples[field] ?? `Sample ${field.replaceAll("_", " ")}`;
}

function buildDirectSendTemplate(
  template: MasterTemplate | null,
  theme: EmailThemeTokens,
) {
  if (!template) {
    return null;
  }

  if (template.type === "html") {
    if (!template.html) {
      return null;
    }

    return {
      type: "html" as const,
      subject: template.subject,
      previewText: template.previewText,
      html: template.html,
    };
  }

  if (!template.content) {
    return null;
  }

  return {
    type: "structured" as const,
    templateId: template.sourceTemplateId,
    subject: template.subject,
    previewText: template.previewText,
    content: template.content,
    theme,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

function buildTestSendProofKey(
  template: MasterTemplate | null,
  theme: EmailThemeTokens,
) {
  if (!template) {
    return "no-template";
  }

  return JSON.stringify({
    templateId: template.id,
    updatedAt: template.updatedAt,
    type: template.type,
    subject: template.subject,
    previewText: template.previewText,
    content: template.content,
    html: template.html,
    theme,
  });
}

function freshTestSendProof(proof: TestSendProof | null, proofKey: string) {
  if (
    !proof ||
    proof.proofKey !== proofKey ||
    Date.parse(proof.expiresAt) <= Date.now()
  ) {
    return null;
  }

  return proof;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function slugifyFilename(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "email-template"
  );
}

function downloadTextFile({
  filename,
  mimeType,
  content,
}: {
  filename: string;
  mimeType: string;
  content: string;
}) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function readStorage<T>(key: string, fallback: T): T {
  if (!canUseLocalStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

const adminPanelClass = "rounded-lg border bg-card";

const adminInsetClass = "rounded-lg border bg-muted/30";

const adminSecondaryButtonClass =
  "h-8 rounded-md border border-border bg-card px-3 text-foreground shadow-none transition-colors hover:bg-muted hover:text-foreground";

const adminPrimaryButtonClass =
  "h-8 rounded-md bg-primary px-3 text-primary-foreground shadow-none transition-colors hover:bg-primary/90";

const adminDangerButtonClass =
  "h-8 rounded-md border border-border bg-card px-3 text-muted-foreground shadow-none transition-colors hover:bg-destructive/10 hover:text-destructive";

const adminIconButtonClass =
  "rounded-md border border-border bg-card text-foreground shadow-none transition-colors hover:bg-muted hover:text-foreground";

const adminMiniButtonClass =
  "rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

const codeClass =
  "font-red-hat rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground";

const inputClass =
  "font-red-hat h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:font-red-hat placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

const textareaClass =
  "font-red-hat w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors placeholder:font-red-hat placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";
