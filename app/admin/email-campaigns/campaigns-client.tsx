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
  Copy,
  Database,
  Download,
  FileText,
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
  Search,
  Send,
  Sparkles,
  Smartphone,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

interface SendJobFailure {
  email?: string;
  error: string | null;
}

interface SendJobSnapshot {
  total: number;
  sentCount: number;
  failedCount: number;
  pendingCount?: number;
  sendingCount?: number;
  complete: boolean;
  failures: SendJobFailure[];
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
  const templateSearchPopoverRef = useRef<HTMLInputElement | null>(null);
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
  const [sendOneEmail, setSendOneEmail] = useState("");
  const [sendStatus, setSendStatus] = useState<DirectSendStatus | null>(() =>
    loadStoredSendStatus(),
  );
  const [testSendProof, setTestSendProof] = useState<TestSendProof | null>(() =>
    loadStoredTestSendProof(),
  );
  const [testSendJob, setTestSendJob] = useState<SendJobSnapshot | null>(null);
  const [sendOneJob, setSendOneJob] = useState<SendJobSnapshot | null>(null);
  const sendStatusRef = useRef<DirectSendStatus | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    initialTemplates[0]?.id ?? "",
  );
  const [templatesPanelCollapsed, setTemplatesPanelCollapsed] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateSearchOpen, setTemplateSearchOpen] = useState(false);
  const [templateSearchAnchor, setTemplateSearchAnchor] = useState({
    top: 0,
    left: 0,
  });
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
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    sendStatusRef.current = sendStatus;
  }, [sendStatus]);

  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );
  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    if (!query) {
      return templates;
    }

    return templates.filter((template) => {
      const haystack = [template.name, template.description, template.subject]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [templateSearch, templates]);
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
    } catch {
      setNotice("Template could not be saved to the database.");
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
    } catch {
      setNotice("Styles could not be saved to the database.");
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
    } catch {
      const nextTemplates = [template, ...templates];
      setTemplates(nextTemplates);
      setSelectedTemplateId(template.id);
      clearSendStatus();
      setNotice("Upload kept as a local draft. Database save failed.");
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
      if (!isLocalDraftTemplateId(templateToDelete.id)) {
        await deleteEmailTemplateAction(templateToDelete.id);
      }

      const nextTemplates = templates.filter(
        (template) => template.id !== templateToDelete.id,
      );
      setTemplates(nextTemplates);
      setSelectedTemplateId(nextTemplates[0]?.id ?? "");
      clearSendStatus();
      setNotice("");
    } catch (error) {
      const message = errorMessage(error);
      setNotice(message);
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
    } catch {
      setNotice("Could not copy AI context.");
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
    } catch (error) {
      const message = errorMessage(error);
      setNotice(message);
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
    } catch (error) {
      const message = errorMessage(error);
      setNotice(message);
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
    } catch {
    } finally {
      setBusy(null);
    }
  }

  async function loadAudienceRecipients() {
    setBusy("load-audience");
    try {
      const resolved = (await resolveEmailAudienceAction({
        query: audienceQuery,
      })) as AudienceResolveResult;
      setRecipientText(resolved.recipientText);
      storeSendRecipients(resolved.recipientText);
      setRecipientResult(resolved);
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
    } catch {
    } finally {
      setBusy(null);
    }
  }

  function updateAudienceQuery(patch: Partial<EmailAudienceQuery>) {
    setAudienceQuery((current) => ({ ...current, ...patch }));
    setRecipientResult(null);
    setRecipientText("");
    removeStoredSendRecipients();
    clearSendStatus();
  }

  function changeRecipientSource(source: RecipientSource) {
    setRecipientSource(source);
    setRecipientResult(null);
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
    setSendOneJob({
      total: 1,
      sentCount: 0,
      failedCount: 0,
      complete: false,
      failures: [],
    });
    try {
      const data = await sendOneDirectEmailAction({
        template,
        email: sendOneEmail,
        mergeData: effectiveMergePreviewData,
      });
      const sent = data.result.status === "sent";
      setSendOneJob({
        total: 1,
        sentCount: sent ? 1 : 0,
        failedCount: sent ? 0 : 1,
        complete: true,
        failures: sent
          ? []
          : [
              {
                email: sendOneEmail,
                error: data.result.error || "Send failed",
              },
            ],
      });
    } catch (error) {
      setSendOneJob({
        total: 1,
        sentCount: 0,
        failedCount: 1,
        complete: true,
        failures: [
          {
            email: sendOneEmail,
            error: errorMessage(error),
          },
        ],
      });
    } finally {
      setBusy(null);
    }
  }

  async function sendTestEmails() {
    const template = buildDirectSendTemplate(selectedTemplate, theme);
    if (!template) return;

    setBusy("test-send");
    setTestSendJob({
      total: 0,
      sentCount: 0,
      failedCount: 0,
      complete: false,
      failures: [],
    });
    try {
      const data = await sendDirectTestEmailsAction({
        template,
        mergeData: effectiveMergePreviewData,
      });
      const sent = data.results.filter((result) => result.status === "sent");
      const failed = data.results.filter((result) => result.status !== "sent");
      setTestSendJob({
        total: data.results.length,
        sentCount: sent.length,
        failedCount: failed.length,
        complete: true,
        failures: failed.map((result) => ({
          error: result.error || "Send failed",
        })),
      });
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
    } catch (error) {
      clearTestSendProof();
      setTestSendJob({
        total: 0,
        sentCount: 0,
        failedCount: 0,
        complete: true,
        failures: [{ error: errorMessage(error) }],
      });
    } finally {
      setBusy(null);
    }
  }

  async function startFullSend() {
    const template = buildDirectSendTemplate(selectedTemplate, theme);
    if (!template) return;
    const proof = activeTestSendProof;

    if (!proof && !activeSendStatus) {
      return;
    }

    setBusy("start-send");
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

      if (status?.complete) {
        clearCompletedSend();
      }
    } catch (error) {
      const current = sendStatusRef.current;
      if (!current) {
        return;
      }

      commitSendStatus({
        ...current,
        recentFailures: mergeSendFailures(current.recentFailures, [
          { email: "", error: errorMessage(error) },
        ]),
      });
    } finally {
      setBusy(null);
    }
  }

  function commitSendStatus(status: DirectSendStatus) {
    const current = sendStatusRef.current;
    const recentFailures =
      current?.runId === status.runId
        ? mergeSendFailures(current.recentFailures, status.recentFailures)
        : status.recentFailures;
    const next = { ...status, recentFailures };
    sendStatusRef.current = next;
    setSendStatus(next);
    storeSendStatus(next);
  }

  function clearSendStatus() {
    sendStatusRef.current = null;
    setSendStatus(null);
    removeStoredSendStatus();
  }

  function clearCompletedSend() {
    setRecipientText("");
    setRecipientResult(null);
    removeStoredSendRecipients();
    removeStoredSendStatus();
  }

  async function resolveInterruptedDelivery() {
    const template = buildDirectSendTemplate(selectedTemplate, theme);
    const status = activeSendStatus;

    if (!template || !status || !status.interrupted) {
      return;
    }

    setBusy("start-send");
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
      }
    } catch (error) {
      commitSendStatus({
        ...status,
        recentFailures: mergeSendFailures(status.recentFailures, [
          { email: "", error: errorMessage(error) },
        ]),
      });
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
    setNotice("");
    clearSendStatus();
    setTestSendJob(null);
    setSendOneJob(null);
  }

  function updateTheme(nextTheme: EmailThemeTokens) {
    setTheme(nextTheme);
    clearSendStatus();
    setTestSendJob(null);
    setSendOneJob(null);
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

    const timer = window.setTimeout(
      () => {
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
            commitSendStatus(nextStatus);
          })
          .catch((error) => {
            const current = sendStatusRef.current;
            if (!current) {
              return;
            }

            commitSendStatus({
              ...current,
              recentFailures: mergeSendFailures(current.recentFailures, [
                { email: "", error: errorMessage(error) },
              ]),
            });
          });
      },
      delayUntil(leaseExpiresAt, 250),
    );

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

  const templatesUploadInput = (
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
  );

  const collapsedTemplateSearchResults =
    templates.length === 0 ? (
      <div className="p-4 text-sm text-muted-foreground">No templates yet.</div>
    ) : filteredTemplates.length === 0 ? (
      <div className="p-4 text-sm text-muted-foreground">
        No templates match your search.
      </div>
    ) : (
      <div className="divide-y">
        {filteredTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => {
              selectTemplate(template.id);
              setTemplateSearchOpen(false);
            }}
            className={cn(
              "block w-full px-4 py-3 text-left transition-colors hover:bg-muted/60",
              selectedTemplateId === template.id && "bg-muted hover:bg-muted",
            )}
          >
            <p className="truncate text-sm font-semibold">{template.name}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {template.description || template.subject}
            </p>
          </button>
        ))}
      </div>
    );

  const templatesAddMenu = (
    triggerSize: "icon-sm" | "icon-lg",
    triggerVariant: "ghost" | "outline",
  ) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          size={triggerSize}
          className="shrink-0"
          title="Add template"
          aria-label="Add template"
        >
          <Plus />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40 w-auto">
        <DropdownMenuItem onSelect={createStructuredTemplate}>
          <Plus />
          New template
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy === "upload"}
          onSelect={() => uploadRef.current?.click()}
        >
          <Upload />
          Upload HTML
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const templatesListBody = showTemplatesRail ? (
    <div className="flex h-full flex-col items-center gap-1 py-3">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Expand templates panel"
        aria-label="Expand templates panel"
        onClick={() => {
          setTemplateSearchOpen(false);
          setTemplatesPanelCollapsed(false);
          templatesPanelRef.current?.expand();
        }}
      >
        <PanelLeftOpen />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Search templates"
        aria-label="Search templates"
        aria-expanded={templateSearchOpen}
        aria-haspopup="dialog"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setTemplateSearchAnchor({ top: rect.top, left: rect.left });
          setTemplateSearchOpen((open) => !open);
        }}
      >
        <Search />
      </Button>
      {templatesAddMenu("icon-sm", "ghost")}
      {templatesUploadInput}
    </div>
  ) : (
    <>
      <div className="shrink-0 space-y-2.5 border-b p-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-sm font-semibold">Templates</h2>
          {panelsMounted ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="ml-auto shrink-0"
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
        </div>
        {templatesUploadInput}
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={templateSearch}
              onChange={(event) => setTemplateSearch(event.target.value)}
              placeholder="Search templates"
              aria-label="Search templates"
              className={cn(inputClass, "pl-9")}
            />
          </div>
          {templatesAddMenu("icon-lg", "outline")}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {templates.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No templates yet.
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No templates match your search.
          </div>
        ) : (
          <div className="divide-y">
            {filteredTemplates.map((template) => (
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
                <p className="truncate text-sm font-semibold">
                  {template.name}
                </p>
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
        onOpenAiDraft={() => setAiDraftOpen(true)}
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
        sendOneEmail={sendOneEmail}
        sendStatus={activeSendStatus}
        testSendProof={activeTestSendProof}
        testSendJob={testSendJob}
        sendOneJob={sendOneJob}
        busy={busy}
        onRecipientSourceChange={changeRecipientSource}
        onRecipientTextChange={(value) => {
          setRecipientText(value);
          storeSendRecipients(value);
          setRecipientResult(null);
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
        onDelete={deleteSelectedTemplate}
        canDelete={selectedTemplate !== null}
        templateName={selectedTemplate?.name ?? ""}
        busy={busy}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{workspaceBody}</div>
    </>
  );

  const previewBody = (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Preview</h2>
        <div className="inline-flex items-center gap-0.5 rounded-pill border bg-muted p-0.5">
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
                  const collapsed = size.inPixels <= 48;
                  setTemplatesPanelCollapsed(collapsed);
                  if (!collapsed) {
                    setTemplateSearchOpen(false);
                  }
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
        {showTemplatesRail ? (
          <Popover
            open={templateSearchOpen}
            onOpenChange={setTemplateSearchOpen}
          >
            <PopoverAnchor
              className="pointer-events-none fixed size-px"
              style={{
                top: templateSearchAnchor.top,
                left: templateSearchAnchor.left,
              }}
            />
            <PopoverContent
              side="right"
              align="start"
              sideOffset={0}
              avoidCollisions={false}
              className="font-red-hat w-72 gap-0 p-0"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                templateSearchPopoverRef.current?.focus();
              }}
            >
              <div className="border-b p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={templateSearchPopoverRef}
                    type="search"
                    value={templateSearch}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    placeholder="Search templates"
                    aria-label="Search templates"
                    className={cn(inputClass, "pl-9")}
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {collapsedTemplateSearchResults}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
        <AlertDialog open={aiDraftOpen} onOpenChange={setAiDraftOpen}>
          <AlertDialogContent className="!flex z-50 h-auto max-h-[calc(100dvh-2rem)] w-[min(72rem,calc(100vw-2rem))] !max-w-none flex-col gap-0 overflow-hidden p-0">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
              <AlertDialogHeader className="gap-1 p-0 place-items-start text-left">
                <AlertDialogTitle>AI drafting</AlertDialogTitle>
                <AlertDialogDescription>
                  Draft with AI, then apply the result to this template.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogCancel
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
              >
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </AlertDialogCancel>
            </div>
            <div className="min-h-0 overflow-y-auto px-4 py-4">
              {selectedTemplate ? (
                <AiDraftPanel
                  draftText={aiDraftText}
                  templateType={selectedTemplate.type}
                  aiDescription={aiDescription}
                  generateBusy={busy === "generate-ai-draft"}
                  onAiDescriptionChange={setAiDescription}
                  onCopyAiContext={() => void copyAiTemplateContext()}
                  onDraftTextChange={setAiDraftText}
                  onGenerateDraft={() => void generateAiTemplateDraft()}
                  onImportDraft={importAiTemplateDraft}
                />
              ) : null}
            </div>
          </AlertDialogContent>
        </AlertDialog>
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
  onDelete,
  canDelete,
  templateName,
  busy,
}: {
  activeView: EmailCampaignSurface;
  onViewChange: (view: EmailCampaignSurface) => void;
  onSave: () => void;
  onDelete: () => void;
  canDelete: boolean;
  templateName: string;
  busy: string | null;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const saveBusy =
    activeView === "styles" ? busy === "save-styles" : busy === "save-template";
  const deleteBusy = busy === "delete-template";
  const deleteLabel = templateName.trim() || "this template";

  return (
    <div className="flex h-14 shrink-0 flex-nowrap items-center justify-between gap-3 border-b bg-card px-4">
      <EmailCampaignViewNav
        activeView={activeView}
        onViewChange={onViewChange}
      />
      <div className="flex shrink-0 items-center gap-2">
        {canDelete ? (
          <Button
            className={cn(adminDangerButtonClass, "shrink-0")}
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={deleteBusy}
          >
            <Trash2 />
            Delete
          </Button>
        ) : null}
        <Button
          className={cn(adminPrimaryButtonClass, "shrink-0")}
          onClick={onSave}
          disabled={saveBusy}
        >
          <Save />
          Save
        </Button>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteLabel} will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  onOpenAiDraft,
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
  onOpenAiDraft: () => void;
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
            onClick={onOpenAiDraft}
            aria-label="AI drafting"
          >
            <Sparkles />
          </Button>
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
  const draftPlaceholder =
    templateType === "html"
      ? '{ "subject": "...", "previewText": "...", "html": "<p>...</p>" }'
      : '{ "subject": "...", "previewText": "...", "content": { "heading": "...", "sections": [...] } }';

  return (
    <div>
      <AiDraftStep
        step={1}
        title="Create a draft"
        description="Describe the email, then generate here or copy context for your own agent."
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              className={adminSecondaryButtonClass}
              disabled={generateBusy}
              onClick={onCopyAiContext}
            >
              <Copy />
              Copy for agent
            </Button>
            <Button
              type="button"
              className={adminPrimaryButtonClass}
              disabled={generateBusy || !aiDescription.trim()}
              onClick={onGenerateDraft}
            >
              {generateBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles />
              )}
              {generateBusy ? "Generating…" : "Generate"}
            </Button>
          </>
        }
      >
        <textarea
          className={textareaClass}
          rows={4}
          value={aiDescription}
          disabled={generateBusy}
          onChange={(event) => onAiDescriptionChange(event.target.value)}
          placeholder="RSVP reminder for accepted hackers. Friendly tone, Friday deadline."
        />
      </AiDraftStep>

      <AiDraftStep
        step={2}
        title="Import JSON"
        description="Paste the draft JSON below and apply it to this template."
        divided
        actions={
          <Button
            type="button"
            className={adminPrimaryButtonClass}
            disabled={generateBusy || !draftText.trim()}
            onClick={onImportDraft}
          >
            Import
          </Button>
        }
      >
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
            className={cn(textareaClass, "font-mono text-xs")}
            rows={4}
            value={draftText}
            disabled={generateBusy}
            onChange={(event) => onDraftTextChange(event.target.value)}
            placeholder={draftPlaceholder}
          />
        </div>
      </AiDraftStep>
    </div>
  );
}

function AiDraftStep({
  step,
  title,
  description,
  divided = false,
  actions,
  children,
}: {
  step: number;
  title: string;
  description: string;
  divided?: boolean;
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("space-y-3", divided && "mt-6 border-t border-border pt-6")}
    >
      <AiDraftStepHeader step={step} title={title} description={description} />
      {children}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {actions}
      </div>
    </section>
  );
}

function AiDraftStepHeader({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">
        <span className="text-muted-foreground">{step}.</span> {title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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
        className="overflow-hidden rounded-lg border border-border bg-card"
      >
        <AccordionTrigger className="items-center px-3 py-2 text-sm font-medium hover:no-underline">
          <span className="flex min-w-0 items-center gap-2">
            Sample recipient
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-normal tabular-nums text-muted-foreground">
              {fields.length}
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-0 pb-0">
          <ul className="divide-y divide-border/70 border-t border-border/70">
            {fields.map((field) => (
              <li key={field}>
                <label className="flex items-center gap-3 px-3 py-1.5 hover:bg-muted/40">
                  <code className="w-36 shrink-0 truncate font-mono text-[11px] text-muted-foreground">
                    {`{{${field}}}`}
                  </code>
                  <input
                    aria-label={`Sample value for ${field}`}
                    className={cn(inputClass, "h-8 min-w-0 flex-1")}
                    value={values[field] ?? ""}
                    placeholder={defaultMergeValue(field)}
                    onChange={(event) => onChange(field, event.target.value)}
                  />
                </label>
              </li>
            ))}
          </ul>
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
  sendOneEmail,
  sendStatus,
  testSendProof,
  testSendJob,
  sendOneJob,
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
  sendOneEmail: string;
  sendStatus: DirectSendStatus | null;
  testSendProof: TestSendProof | null;
  testSendJob: SendJobSnapshot | null;
  sendOneJob: SendJobSnapshot | null;
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

  const templateTypeLabel = selectedTemplate
    ? selectedTemplate.type === "html"
      ? "HTML template"
      : "Structured template"
    : "Select a template to send.";
  const limitsLabel = `${limits.maxRecipients} max recipients, ${limits.batchSize}/batch, about ${sendRate}/sec${
    limits.maxSendRatePerSecond ? ` max ${limits.maxSendRatePerSecond}/sec` : ""
  }`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {selectedTemplate?.name ?? "Send"}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {templateTypeLabel} · {limitsLabel}
        </p>
      </div>

      {!templateCanSend ? (
        <p className="text-sm text-muted-foreground">
          Select a template with content before sending.
        </p>
      ) : null}

      <EditorSection
        title="Send required organizer test"
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={adminSecondaryButtonClass}
            disabled={!templateCanSend || Boolean(busy)}
            onClick={onTestSend}
          >
            <ListChecks />
            {busy === "test-send" ? "Sending..." : "Test"}
          </Button>
        }
      >
        {testSendProof || testSendJob || busy === "test-send" ? (
          <SendJobProgress
            busy={busy === "test-send"}
            job={
              testSendJob ??
              (testSendProof
                ? {
                    total: testSendProof.totalCount,
                    sentCount: testSendProof.sentCount,
                    failedCount: 0,
                    complete: true,
                    failures: [],
                  }
                : null)
            }
            detail={
              testSendProof
                ? `Unlocked until ${formatTime(testSendProof.expiresAt)}.`
                : undefined
            }
          />
        ) : null}
      </EditorSection>

      <EditorSection title="Send one">
        <div className="flex items-center gap-2">
          <input
            className={inputClass}
            type="email"
            value={sendOneEmail}
            onChange={(event) => onSendOneEmailChange(event.target.value)}
            placeholder="one@email.com"
          />
          <Button
            type="button"
            size="sm"
            className={adminPrimaryButtonClass}
            disabled={!templateCanSend || !sendOneEmail || Boolean(busy)}
            onClick={onSendOne}
          >
            <Send />
            {busy === "send-one" ? "Sending..." : "Send"}
          </Button>
        </div>
        <SendJobProgress busy={busy === "send-one"} job={sendOneJob} />
      </EditorSection>

      <EditorSection
        title="Load a recipient group"
        action={
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant={recipientSource === "manual" ? "default" : "ghost"}
              size="sm"
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
              size="sm"
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
        }
      >
        {recipientSource === "audience" ? (
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
        ) : null}
        <textarea
          className={cn(
            textareaClass,
            "min-h-36 text-xs disabled:cursor-not-allowed disabled:opacity-60",
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
        <div className="flex items-center justify-end gap-3">
          {recipientResult ? (
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              {recipientResult.emails.length} valid,{" "}
              {recipientResult.duplicateCount} duplicates,{" "}
              {recipientResult.invalid.length} invalid
            </p>
          ) : null}
          {recipientSource === "audience" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={adminSecondaryButtonClass}
              disabled={!fullSendUnlocked || Boolean(busy)}
              onClick={onLoadAudience}
            >
              <Database />
              {busy === "load-audience" ? "Loading..." : "Load group"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={adminSecondaryButtonClass}
              disabled={recipientInputDisabled || !recipientText.trim()}
              onClick={onCheckRecipients}
            >
              <Users />
              {busy === "check-recipients" ? "Checking..." : "Check list"}
            </Button>
          )}
        </div>
      </EditorSection>

      <EditorSection
        title="Send to all loaded recipients"
        action={
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={adminSecondaryButtonClass}
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
                    : "Send all"}
            </Button>
            {sendStatus?.interrupted ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={adminSecondaryButtonClass}
                disabled={Boolean(busy)}
                onClick={onResolveInterrupted}
              >
                <ListChecks />
                Resolve interrupted delivery
              </Button>
            ) : null}
          </div>
        }
      >
        {sendStatus || busy === "start-send" ? (
          <>
            <SendJobProgress
              busy={busy === "start-send"}
              job={
                sendStatus
                  ? {
                      total: sendStatus.totalRecipients,
                      sentCount: sendStatus.sentCount,
                      failedCount: sendStatus.failedCount,
                      pendingCount: sendStatus.pendingCount,
                      sendingCount: sendStatus.sendingCount,
                      complete: sendStatus.complete,
                      failures: sendStatus.recentFailures,
                    }
                  : null
              }
              detail={
                sendStatus?.leaseActive && sendStatus.leaseExpiresAt
                  ? `Recovery available at ${formatTime(sendStatus.leaseExpiresAt)}`
                  : sendStatus?.interrupted
                    ? "Verify the interrupted delivery in SES before resolving it."
                    : undefined
              }
            />
            {sendStatus?.interrupted &&
            sendStatus.unverifiedRecipients.length ? (
              <div className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Verify in SES before resolving:{" "}
                {sendStatus.unverifiedRecipients.join(", ")}
              </div>
            ) : null}
          </>
        ) : null}
      </EditorSection>
    </div>
  );
}

function SendJobProgress({
  busy = false,
  job,
  detail,
}: {
  busy?: boolean;
  job: SendJobSnapshot | null;
  detail?: string;
}) {
  if (!job && !busy) {
    return null;
  }

  const total = job?.total ?? 0;
  const sentCount = job?.sentCount ?? 0;
  const failedCount = job?.failedCount ?? 0;
  const processed = sentCount + failedCount;
  const progress =
    total > 0 ? Math.round((processed / total) * 100) : busy ? null : 0;
  const sentWidth = total > 0 ? (sentCount / total) * 100 : 0;
  const failedWidth = total > 0 ? (failedCount / total) * 100 : 0;
  const summary = total
    ? `${sentCount} sent, ${failedCount} failed${
        job?.pendingCount ? `, ${job.pendingCount} pending` : ""
      }${job?.sendingCount ? `, ${job.sendingCount} sending` : ""}`
    : busy
      ? "Sending..."
      : "Send failed";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>{summary}</p>
        {progress !== null ? <span>{progress}%</span> : null}
      </div>
      <div className="flex h-2 overflow-hidden rounded-md bg-muted">
        {progress === null ? (
          <div className="h-full w-2/3 animate-pulse rounded-md bg-primary" />
        ) : (
          <>
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${sentWidth}%` }}
            />
            <div
              className="h-full bg-destructive transition-all duration-500"
              style={{ width: `${failedWidth}%` }}
            />
          </>
        )}
      </div>
      {detail ? (
        <p className="text-sm text-muted-foreground">{detail}</p>
      ) : null}
      {job?.failures.length ? (
        <div className="space-y-2">
          {job.failures.map((failure, index) => (
            <p
              key={`${failure.email ?? "recipient"}-${failure.error}-${index}`}
              className="rounded-md border border-red-200/60 bg-red-50 px-3 py-2 text-sm text-red-900"
            >
              {failure.email
                ? `${failure.email}: ${failure.error || "Send failed"}`
                : failure.error || "Send failed"}
            </p>
          ))}
        </div>
      ) : null}
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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Styles</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Theme tokens used by structured emails.
        </p>
      </div>

      <EditorSection title="Colors">
        <div className="grid gap-3 sm:grid-cols-2">
          {colorFields.map(([key, label]) => (
            <label key={key} className="flex items-center gap-3">
              <span
                className="relative size-9 shrink-0 overflow-hidden rounded-md border border-border focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50"
                style={{ backgroundColor: String(theme[key]) }}
              >
                <input
                  type="color"
                  value={String(theme[key])}
                  onChange={(event) =>
                    onThemeChange({ ...theme, [key]: event.target.value })
                  }
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-muted-foreground">
                  {label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {String(theme[key])}
                </span>
              </span>
            </label>
          ))}
        </div>
      </EditorSection>

      <EditorSection title="Sizes">
        <div className="grid gap-3 sm:grid-cols-2">
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
      </EditorSection>
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
      className={`flex size-6 items-center justify-center rounded-pill border border-transparent transition-colors [&_svg]:size-3.5 ${
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
  children?: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-5 first:border-t-0 first:pt-0">
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          children ? "mb-3" : null,
        )}
      >
        <h3 className="min-w-0 flex-1 text-sm font-medium text-foreground">
          {title}
        </h3>
        {action}
      </div>
      {children ? <div className="space-y-3">{children}</div> : null}
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
  return templateId.startsWith("seed-") || isLocalDraftTemplateId(templateId);
}

function isLocalDraftTemplateId(templateId: string) {
  return templateId.startsWith("local-");
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

function delayUntil(timestamp: string, extraMs = 0) {
  return Math.max(0, Date.parse(timestamp) - Date.now() + extraMs);
}

function mergeSendFailures(
  current: DirectSendStatus["recentFailures"],
  incoming: DirectSendStatus["recentFailures"],
) {
  const seen = new Set(
    current.map((failure) => `${failure.email}\0${failure.error ?? ""}`),
  );
  const merged = [...current];

  for (const failure of incoming) {
    const key = `${failure.email}\0${failure.error ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(failure);
  }

  return merged;
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

const adminSecondaryButtonClass =
  "rounded-md border border-border bg-card px-3 text-foreground shadow-none transition-colors hover:bg-muted hover:text-foreground";

const adminPrimaryButtonClass =
  "rounded-md bg-primary px-3 text-primary-foreground shadow-none transition-colors hover:bg-primary/90";

const adminDangerButtonClass =
  "rounded-md bg-destructive/10 px-3 text-destructive shadow-none transition-colors hover:bg-destructive/20";

const adminIconButtonClass =
  "rounded-md border border-border bg-card text-foreground shadow-none transition-colors hover:bg-muted hover:text-foreground";

const adminMiniButtonClass =
  "rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

const inputClass =
  "font-red-hat h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:font-red-hat placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

const textareaClass =
  "font-red-hat w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors placeholder:font-red-hat placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";
