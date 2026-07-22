"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Laptop,
  ListChecks,
  Loader2,
  Palette,
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
import { AdminHeaderActions } from "@/app/admin/components/admin-header-actions";
import { adminPageHeaderClasses } from "@/app/admin/components/admin-page-header-layout";
import { Button } from "@/components/ui/button";
import type { EmailCampaignContent, EmailThemeTokens } from "@/lib/email/types";
import { cn } from "@/lib/utils";
import {
  deleteEmailTemplateAction,
  saveEmailTemplateAction,
  saveEmailThemeAction,
} from "./actions";

type PreviewMode = "desktop" | "mobile";
export type EmailCampaignSurface = "builder" | "styles" | "send";
type TemplateType = "structured" | "html";
type ToastTone = "loading" | "success" | "error" | "info";

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

interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  subject: string;
  previewText: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  isDirectSend: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RecipientSaveResult {
  emails: string[];
  invalid: string[];
  duplicateCount: number;
  columns?: string[];
}

interface DirectSendStatus {
  campaignId?: string;
  proofKey?: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  sendingCount: number;
  nextCursor: number;
  complete: boolean;
  invalid: string[];
  duplicateCount: number;
  columns?: string[];
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

const templatesStorageKey = "mhacks-email-master-templates";
const themeStorageKey = "mhacks-email-active-theme";
const themeStorageVersionKey = "mhacks-email-active-theme-version";
const currentThemeStorageVersion = "m26-single-font-config";
const activeSendStatusStorageKey = "mhacks-email-active-send-status";
const activeTestProofStorageKey = "mhacks-email-active-test-proof";
const serverManagedTestListLabel =
  "Server-managed required organizer test list";
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
  initialCampaigns,
  initialCampaignLimits,
}: {
  initialSurface: EmailCampaignSurface;
  initialTemplates: MasterTemplate[];
  initialTheme: EmailThemeTokens;
  initialCampaigns: CampaignSummary[];
  initialCampaignLimits: CampaignLimits;
}) {
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const toastIdRef = useRef(0);
  const [surface, setSurface] = useState<EmailCampaignSurface>(initialSurface);
  const [templates, setTemplates] =
    useState<MasterTemplate[]>(initialTemplates);
  const [campaignLimits] = useState<CampaignLimits>(initialCampaignLimits);
  const [campaigns] = useState<CampaignSummary[]>(initialCampaigns);
  const [recipientText, setRecipientText] = useState("");
  const [recipientResult, setRecipientResult] =
    useState<RecipientSaveResult | null>(null);
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
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [theme, setTheme] = useState<EmailThemeTokens>(initialTheme);
  const [mergePreviewData, setMergePreviewData] = useState<
    Record<string, string>
  >({});
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [notice, setNotice] = useState("");
  const [aiDraftText, setAiDraftText] = useState("");
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
    setSelectedSectionIndex(0);
    clearSendStatus();
    storeTemplates(nextTemplates);
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
      storeTemplates(nextTemplates);
      setNotice("Template uploaded.");
      showToast("success", "Template uploaded", "Saved to the database.");
    } catch {
      const nextTemplates = [template, ...templates];
      setTemplates(nextTemplates);
      setSelectedTemplateId(template.id);
      clearSendStatus();
      storeTemplates(nextTemplates);
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
    setSelectedSectionIndex(selectedTemplate.content.sections.length);
  }

  function removeSection(index: number) {
    if (!selectedTemplate?.content) return;
    const sections = selectedTemplate.content.sections.filter(
      (_section, sectionIndex) => sectionIndex !== index,
    );
    updateContent({
      sections:
        sections.length > 0
          ? sections
          : [
              {
                id: crypto.randomUUID(),
                title: "Main",
                body: "Add copy here.",
              },
            ],
    });
    setSelectedSectionIndex(Math.max(0, index - 1));
  }

  function moveSection(index: number, direction: -1 | 1) {
    if (!selectedTemplate?.content) return;
    const nextIndex = index + direction;
    const sections = [...selectedTemplate.content.sections];
    if (nextIndex < 0 || nextIndex >= sections.length) return;
    const [section] = sections.splice(index, 1);
    sections.splice(nextIndex, 0, section);
    updateContent({ sections });
    setSelectedSectionIndex(nextIndex);
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
    storeTemplates(nextTemplates);
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
      storeTemplates(nextTemplates);
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
      const context = buildAiTemplateContext(selectedTemplate, mergeFields);
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

  function importAiTemplateDraft() {
    if (!selectedTemplate) return;

    try {
      const draft = parseAiTemplateDraft(
        aiDraftText,
        selectedTemplate,
        mergeFields,
      );
      const now = new Date().toISOString();
      const newTemplate: MasterTemplate = {
        ...selectedTemplate,
        ...draft,
        id: `local-template-${crypto.randomUUID()}`,
        name: draft.name ?? `${selectedTemplate.name} AI draft`,
        status: "active",
        updatedAt: now,
      };
      const nextTemplates = [newTemplate, ...templates];
      setTemplates(nextTemplates);
      setSelectedTemplateId(newTemplate.id);
      setSelectedSectionIndex(0);
      clearSendStatus();
      storeTemplates(nextTemplates);
      setAiDraftText("");
      setNotice("AI draft created as a new template. Review before saving.");
      showToast(
        "success",
        "AI draft created",
        "The source template was not changed.",
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
      const rendered = await api<{ html: string }>(
        "/api/admin/email/render/preview",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      setPreviewHtml(rendered.html);
    } catch {
      setPreviewHtml("");
    }
  }

  async function checkRecipientList() {
    setBusy("check-recipients");
    setSendNotice("");
    showToast(
      "loading",
      "Checking recipient list",
      "Validating addresses and merge columns.",
    );
    try {
      const parsed = await api<RecipientSaveResult>(
        "/api/admin/email/send/recipients",
        {
          method: "POST",
          body: JSON.stringify({ recipients: recipientText }),
        },
      );
      setRecipientResult(parsed);
      clearSendStatus();
      setSendNotice(`${parsed.emails.length} recipients ready.`);
      showToast(
        "success",
        "Recipient list ready",
        `${parsed.emails.length} valid, ${parsed.duplicateCount} duplicate${
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

  async function sendOneRecipient() {
    const template = buildDirectSendTemplate(selectedTemplate, theme);
    if (!template) return;

    setBusy("send-one");
    setSendNotice("");
    showToast("loading", "Sending email", `Sending to ${sendOneEmail}.`);
    try {
      const data = await api<{
        result: {
          status: string;
          messageId: string | null;
          error: string | null;
        };
      }>("/api/admin/email/send/one", {
        method: "POST",
        body: JSON.stringify({
          template,
          email: sendOneEmail,
          mergeData: effectiveMergePreviewData,
        }),
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
      const data = await api<{
        results: Array<{
          status: string;
          messageId: string | null;
          error: string | null;
        }>;
        testSendToken: string | null;
        testSendExpiresAt: string | null;
      }>("/api/admin/email/send/test", {
        method: "POST",
        body: JSON.stringify({
          template,
          mergeData: effectiveMergePreviewData,
        }),
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

    if (!proof) {
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
      "Starting the first server-throttled batch.",
    );
    try {
      let status: DirectSendStatus | null = null;
      let cursor = activeSendStatus?.nextCursor ?? 0;
      let sentCount = activeSendStatus?.sentCount ?? 0;
      let failedCount = activeSendStatus?.failedCount ?? 0;
      let campaignId = activeSendStatus?.campaignId;
      let recentFailures: DirectSendStatus["recentFailures"] =
        activeSendStatus?.recentFailures ?? [];

      for (let batch = 0; batch < 1000; batch += 1) {
        status = await api<DirectSendStatus>("/api/admin/email/send/start", {
          method: "POST",
          body: JSON.stringify({
            campaignId,
            template,
            recipients: recipientText,
            testSendToken: proof.token,
            cursor,
            sentCount,
            failedCount,
            recentFailures,
          }),
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
        sentCount = status.sentCount;
        failedCount = status.failedCount;
        campaignId = status.campaignId;
        recentFailures = status.recentFailures;

        if (status.complete) {
          break;
        }

        if (status.sendingCount > 0) {
          break;
        }
      }

      setSendNotice(
        status
          ? status.complete
            ? `Send complete: ${status.sentCount} sent, ${status.failedCount} failed.`
            : `${status.sendingCount} recipient${status.sendingCount === 1 ? "" : "s"} still marked sending. Wait for the active batch to finish before continuing.`
          : "Send complete.",
      );
      showToast(
        status?.complete && !status.failedCount ? "success" : "error",
        status?.complete ? "List send complete" : "List send paused",
        status
          ? status.complete
            ? `${status.sentCount} sent, ${status.failedCount} failed.`
            : `${status.sendingCount} recipient${status.sendingCount === 1 ? "" : "s"} still marked sending.`
          : "Send complete.",
      );
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
    setSelectedSectionIndex(0);
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
      const localTemplates = loadStoredTemplates();
      const localTheme = loadStoredTheme();
      const nextTemplates = mergeTemplates(initialTemplates, localTemplates);

      setTemplates(nextTemplates);
      setSelectedTemplateId((current) =>
        nextTemplates.some((template) => template.id === current)
          ? current
          : nextTemplates[0]?.id || "",
      );

      if (localTheme) {
        setTheme(localTheme);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialTemplates]);

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

  const selectedSection =
    selectedTemplate?.content?.sections[selectedSectionIndex] ?? null;
  const previewWidth = previewMode === "desktop" ? 720 : 390;

  return (
    <div className="font-red-hat flex min-h-0 flex-col gap-5">
      <EmailCampaignHeader activeView={surface} onViewChange={changeSurface} />
      <div className="grid w-full gap-4 md:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_minmax(420px,0.9fr)]">
        <aside className="md:self-stretch">
          <section className={cn(adminPanelClass, "p-4 md:sticky md:top-4")}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                Templates
              </h2>
              <Button
                variant="ghost"
                title="New template"
                className={cn(adminSecondaryButtonClass, "h-8 px-3")}
                onClick={createStructuredTemplate}
              >
                <Plus />
                New
              </Button>
            </div>
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
            <Button
              variant="ghost"
              className={cn(
                adminSecondaryButtonClass,
                "mt-3 w-full justify-start",
              )}
              onClick={() => uploadRef.current?.click()}
              disabled={busy === "upload"}
            >
              <Upload />
              Upload HTML
            </Button>
            <div className="mt-4 space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    selectTemplate(template.id);
                  }}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedTemplateId === template.id
                      ? "border-primary bg-muted/40 "
                      : "border-border bg-card hover:border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {template.name}
                    </p>
                    <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                      {template.type}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {template.description || template.subject}
                  </p>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className={cn(adminPanelClass, "min-h-[740px] p-5")}>
          {surface === "builder" ? (
            <BuilderPanel
              notice={notice}
              selectedTemplate={selectedTemplate}
              selectedSection={selectedSection}
              selectedSectionIndex={selectedSectionIndex}
              mergeFields={mergeFields}
              mergePreviewData={effectiveMergePreviewData}
              busy={busy}
              onSaveTemplate={() => void saveTemplateToMaster()}
              onDownloadTemplate={downloadSelectedTemplate}
              onDeleteTemplate={deleteSelectedTemplate}
              aiDraftText={aiDraftText}
              onAiDraftTextChange={setAiDraftText}
              onCopyAiContext={() => void copyAiTemplateContext()}
              onImportAiDraft={importAiTemplateDraft}
              onMergePreviewDataChange={(field, value) =>
                setMergePreviewData((current) => ({
                  ...current,
                  [field]: value,
                }))
              }
              onTemplateChange={updateSelectedTemplate}
              onContentChange={updateContent}
              onSectionChange={updateSection}
              onSectionSelect={setSelectedSectionIndex}
              onSectionAdd={addSection}
              onSectionRemove={removeSection}
              onSectionMove={moveSection}
            />
          ) : surface === "styles" ? (
            <StylesPanel
              theme={theme}
              busy={busy}
              onThemeChange={updateTheme}
              onSaveStyles={() => void saveStyles()}
            />
          ) : (
            <SendPanel
              selectedTemplate={selectedTemplate}
              limits={campaignLimits}
              recentCampaignCount={campaigns.length}
              recipientText={recipientText}
              recipientResult={recipientResult}
              sendOneEmail={sendOneEmail}
              testEmails={testEmails}
              sendStatus={activeSendStatus}
              testSendProof={activeTestSendProof}
              notice={sendNotice}
              busy={busy}
              onRecipientTextChange={(value) => {
                setRecipientText(value);
                setRecipientResult(null);
                clearSendStatus();
              }}
              onCheckRecipients={() => void checkRecipientList()}
              onSendOneEmailChange={setSendOneEmail}
              onSendOne={() => void sendOneRecipient()}
              onTestSend={() => void sendTestEmails()}
              onStartSend={() => void startFullSend()}
            />
          )}
        </section>

        <section
          className={cn(adminPanelClass, "p-4 md:col-span-2 2xl:col-span-1")}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Preview
              </h2>
              <p className="text-xs text-muted-foreground">
                Live desktop/mobile preview.
              </p>
            </div>
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
          <div className="mt-4 overflow-auto rounded-lg border border-border bg-muted/30 p-4">
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
        </section>
      </div>
      <ToastSnackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function EmailCampaignHeader({
  activeView,
  onViewChange,
}: {
  activeView: EmailCampaignSurface;
  onViewChange: (view: EmailCampaignSurface) => void;
}) {
  const classes = adminPageHeaderClasses("page");

  return (
    <header className={classes.header}>
      <div className={classes.row}>
        <div className="min-w-0">
          <p className="font-red-hat text-xs font-semibold uppercase tracking-[0.22em] text-moss/55 dark:text-sage/60">
            MHacks Organizer
          </p>
          <h1 className={classes.title}>Email Campaigns</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Build reusable templates, preview merge fields, and send CSV-based
            campaigns.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <EmailCampaignViewNav
            activeView={activeView}
            onViewChange={onViewChange}
          />
          <AdminHeaderActions />
        </div>
      </div>
    </header>
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
      className="flex flex-wrap items-center gap-2"
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

function BuilderPanel({
  notice,
  selectedTemplate,
  selectedSection,
  selectedSectionIndex,
  mergeFields,
  mergePreviewData,
  busy,
  onSaveTemplate,
  onDownloadTemplate,
  onDeleteTemplate,
  aiDraftText,
  onAiDraftTextChange,
  onCopyAiContext,
  onImportAiDraft,
  onMergePreviewDataChange,
  onTemplateChange,
  onContentChange,
  onSectionChange,
  onSectionSelect,
  onSectionAdd,
  onSectionRemove,
  onSectionMove,
}: {
  notice: string;
  selectedTemplate: MasterTemplate | null;
  selectedSection: EmailCampaignContent["sections"][number] | null;
  selectedSectionIndex: number;
  mergeFields: string[];
  mergePreviewData: Record<string, string>;
  busy: string | null;
  onSaveTemplate: () => void;
  onDownloadTemplate: () => void;
  onDeleteTemplate: () => void;
  aiDraftText: string;
  onAiDraftTextChange: (value: string) => void;
  onCopyAiContext: () => void;
  onImportAiDraft: () => void;
  onMergePreviewDataChange: (field: string, value: string) => void;
  onTemplateChange: (patch: Partial<MasterTemplate>) => void;
  onContentChange: (patch: Partial<EmailCampaignContent>) => void;
  onSectionChange: (
    index: number,
    patch: Partial<EmailCampaignContent["sections"][number]>,
  ) => void;
  onSectionSelect: (index: number) => void;
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Template editor
          </p>
          <h2 className="text-lg font-semibold text-foreground">
            {selectedTemplate.name}
          </h2>
          {notice ? (
            <p className="mt-1 text-sm text-muted-foreground">{notice}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            className={adminSecondaryButtonClass}
            onClick={onDownloadTemplate}
          >
            <Download />
            Download
          </Button>
          <Button
            variant="ghost"
            className={adminDangerButtonClass}
            onClick={onDeleteTemplate}
          >
            <Trash2 />
            Remove
          </Button>
          <Button
            className={adminPrimaryButtonClass}
            onClick={onSaveTemplate}
            disabled={busy === "save-template"}
          >
            <Save />
            Save to master
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Template name">
          <input
            className={inputClass}
            value={selectedTemplate.name}
            onChange={(event) => onTemplateChange({ name: event.target.value })}
          />
        </Field>
        <Field label="Subject">
          <input
            className={inputClass}
            value={selectedTemplate.subject}
            onChange={(event) =>
              onTemplateChange({ subject: event.target.value })
            }
          />
        </Field>
      </div>
      <Field label="Preview text">
        <input
          className={inputClass}
          value={selectedTemplate.previewText}
          onChange={(event) =>
            onTemplateChange({ previewText: event.target.value })
          }
        />
      </Field>
      <Field label="Description">
        <input
          className={inputClass}
          value={selectedTemplate.description}
          onChange={(event) =>
            onTemplateChange({ description: event.target.value })
          }
        />
      </Field>

      <MergeFieldsPanel
        fields={mergeFields}
        values={mergePreviewData}
        onChange={onMergePreviewDataChange}
      />

      <AiDraftPanel
        draftText={aiDraftText}
        templateType={selectedTemplate.type}
        onCopyContext={onCopyAiContext}
        onDraftTextChange={onAiDraftTextChange}
        onImportDraft={onImportAiDraft}
      />

      {selectedTemplate.type === "html" ? (
        <Field label="HTML template">
          <textarea
            className={`${textareaClass} text-xs`}
            rows={18}
            value={selectedTemplate.html ?? ""}
            onChange={(event) => onTemplateChange({ html: event.target.value })}
          />
        </Field>
      ) : selectedTemplate.content ? (
        <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
          <div className={cn(adminInsetClass, "p-3")}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Blocks
              </p>
              <Button
                size="icon-sm"
                variant="ghost"
                className={adminIconButtonClass}
                onClick={onSectionAdd}
              >
                <Plus />
              </Button>
            </div>
            <div className="space-y-2">
              {selectedTemplate.content.sections.map((section, index) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onSectionSelect(index)}
                  className={`w-full rounded-md border p-3 text-left text-sm transition ${
                    selectedSectionIndex === index
                      ? "border-primary bg-card "
                      : "border-border bg-transparent hover:bg-card"
                  }`}
                >
                  <p className="truncate font-medium text-foreground">
                    {section.title || `Block ${index + 1}`}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {section.body}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
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
            {selectedSection ? (
              <div className={cn(adminInsetClass, "p-4")}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Selected block</p>
                  <div className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className={adminMiniButtonClass}
                      onClick={() => onSectionMove(selectedSectionIndex, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className={adminMiniButtonClass}
                      onClick={() => onSectionMove(selectedSectionIndex, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className={adminMiniButtonClass}
                      onClick={() => onSectionRemove(selectedSectionIndex)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <Field label="Block title">
                  <input
                    className={inputClass}
                    value={selectedSection.title ?? ""}
                    onChange={(event) =>
                      onSectionChange(selectedSectionIndex, {
                        title: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Block copy">
                  <textarea
                    className={textareaClass}
                    rows={7}
                    value={selectedSection.body}
                    onChange={(event) =>
                      onSectionChange(selectedSectionIndex, {
                        body: event.target.value,
                      })
                    }
                  />
                </Field>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="CTA label">
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
                />
              </Field>
              <Field label="CTA URL">
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
                />
              </Field>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AiDraftPanel({
  draftText,
  templateType,
  onCopyContext,
  onDraftTextChange,
  onImportDraft,
}: {
  draftText: string;
  templateType: TemplateType;
  onCopyContext: () => void;
  onDraftTextChange: (value: string) => void;
  onImportDraft: () => void;
}) {
  return (
    <section className={cn(adminInsetClass, "p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              AI drafting
            </p>
            <span className="rounded border bg-card px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              Beta
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Copy a strict template context for ChatGPT or a local agent, then
            paste its JSON draft here. Imports create a new local template and
            never overwrite the source template.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className={adminSecondaryButtonClass}
          onClick={onCopyContext}
        >
          <Copy />
          Copy AI context
        </Button>
      </div>

      <textarea
        className={cn(textareaClass, "mt-3 min-h-32 text-xs")}
        value={draftText}
        onChange={(event) => onDraftTextChange(event.target.value)}
        placeholder={
          templateType === "html"
            ? '{ "subject": "...", "previewText": "...", "html": "<p>...</p>" }'
            : '{ "subject": "...", "previewText": "...", "content": { "heading": "...", "sections": [...] } }'
        }
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Importing creates a new local draft. It does not save or send.
        </p>
        <Button
          type="button"
          className={adminPrimaryButtonClass}
          disabled={!draftText.trim()}
          onClick={onImportDraft}
        >
          <Sparkles />
          Import AI draft
        </Button>
      </div>
    </section>
  );
}

function MergeFieldsPanel({
  fields,
  values,
  onChange,
}: {
  fields: string[];
  values: Record<string, string>;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <section className={cn(adminInsetClass, "p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recipient data
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Merge fields are recipient-list columns, not values to enter one by
            one. A future audience import should provide one row per recipient
            and one column for each field used here.
          </p>
        </div>
        <span className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          {fields.length} required {fields.length === 1 ? "column" : "columns"}
        </span>
      </div>

      {fields.length > 0 ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Required mailing list columns
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {fields.map((field) => (
                <code key={field} className={codeClass}>
                  {field}
                </code>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              For a 2000 person list, this is handled once at import/send time:
              each CSV/database row supplies its own values for these columns.
            </p>
          </div>

          <div className="rounded-md border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sample preview row
                </span>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Used only to render the preview on the right.
                </p>
              </div>
              <span className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground">
                1 recipient
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {fields.map((field) => (
                <label key={field} className="block space-y-2">
                  <span className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                    <span className="truncate">{field}</span>
                    <code className={codeClass}>{`{{${field}}}`}</code>
                  </span>
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
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          This template does not require extra recipient columns yet.
        </p>
      )}
    </section>
  );
}

function SendPanel({
  selectedTemplate,
  limits,
  recentCampaignCount,
  recipientText,
  recipientResult,
  sendOneEmail,
  testEmails,
  sendStatus,
  testSendProof,
  notice,
  busy,
  onRecipientTextChange,
  onCheckRecipients,
  onSendOneEmailChange,
  onSendOne,
  onTestSend,
  onStartSend,
}: {
  selectedTemplate: MasterTemplate | null;
  limits: CampaignLimits;
  recentCampaignCount: number;
  recipientText: string;
  recipientResult: RecipientSaveResult | null;
  sendOneEmail: string;
  testEmails: string;
  sendStatus: DirectSendStatus | null;
  testSendProof: TestSendProof | null;
  notice: string;
  busy: string | null;
  onRecipientTextChange: (value: string) => void;
  onCheckRecipients: () => void;
  onSendOneEmailChange: (value: string) => void;
  onSendOne: () => void;
  onTestSend: () => void;
  onStartSend: () => void;
}) {
  const sendRate = Math.floor(1000 / Math.max(1, limits.sendDelayMs));
  const templateCanSend = Boolean(
    selectedTemplate &&
    (selectedTemplate.type === "html" || selectedTemplate.content),
  );
  const validatedRecipients = recipientResult?.emails.length ?? 0;
  const fullSendUnlocked = Boolean(testSendProof);
  const recipientInputDisabled = !fullSendUnlocked || Boolean(busy);
  const fullSendReady = Boolean(
    templateCanSend &&
    testSendProof &&
    (recipientText.trim() || sendStatus?.campaignId),
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
            <p className="text-xs text-muted-foreground">
              {recentCampaignCount} recent campaign
              {recentCampaignCount === 1 ? "" : "s"} loaded
            </p>
          </div>
        </div>

        {sendStatus ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Metric
              label="Status"
              value={sendStatus.complete ? "complete" : "sending"}
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
              Paste emails or CSV with an{" "}
              <code className={codeClass}>email</code> column plus merge columns
              like <code className={codeClass}>name</code>.
            </p>
          </div>
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
              ? "email,name,travel_reimbursement\nhacker@umich.edu,Hacker,150.00"
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
              Sends in server-throttled batches. Keep this tab open while the
              list is running.
            </p>
            {sendStatus ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {sendStatus.pendingCount} pending, {sendStatus.sentCount} sent,{" "}
                {sendStatus.failedCount} failed
                {sendStatus.sendingCount
                  ? `, ${sendStatus.sendingCount} sending`
                  : ""}
              </p>
            ) : testSendProof ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Test passed: {testSendProof.sentCount}/
                {testSendProof.totalCount} sent. Full send unlocked until{" "}
                {formatTime(testSendProof.expiresAt)}.
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
              disabled={!fullSendReady || Boolean(busy)}
              onClick={onStartSend}
            >
              <Play />
              {busy === "start-send" ? "Sending..." : "Start send"}
            </Button>
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
      : busy === "send-one"
        ? "Sending one email"
        : busy === "test-send"
          ? "Sending test email"
          : busy === "start-send"
            ? "Sending list"
            : sendStatus?.complete
              ? "Send complete"
              : "Send progress";
  const detail = sendStatus
    ? `${sendStatus.sentCount} sent, ${sendStatus.failedCount} failed, ${sendStatus.pendingCount} pending${
        sendStatus.sendingCount ? `, ${sendStatus.sendingCount} sending` : ""
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
  busy,
  onThemeChange,
  onSaveStyles,
}: {
  theme: EmailThemeTokens;
  busy: string | null;
  onThemeChange: (theme: EmailThemeTokens) => void;
  onSaveStyles: () => void;
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Email styling
          </p>
          <h2 className="text-lg font-semibold text-foreground">Styles</h2>
        </div>
        <Button
          className={adminPrimaryButtonClass}
          onClick={onSaveStyles}
          disabled={busy === "save-styles"}
        >
          <Save />
          Save styles
        </Button>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
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

async function api<T>(
  url: string,
  init?: RequestInit & { skipJsonHeader?: boolean },
): Promise<T> {
  const headers = init?.skipJsonHeader
    ? init.headers
    : { "Content-Type": "application/json", ...init?.headers };
  const response = await fetch(url, { ...init, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Request failed",
    );
  }

  return data as T;
}

function buildAiTemplateContext(
  template: MasterTemplate,
  mergeFields: string[],
) {
  const allowedMergeFields = Array.from(
    new Set([...Object.keys(defaultMergeSamples), ...mergeFields]),
  ).sort((a, b) => a.localeCompare(b));
  const draftSchema =
    template.type === "html"
      ? {
          name: "optional short template name",
          description: "optional admin-only description",
          subject: "required subject, max 180 chars",
          previewText: "optional inbox preview, max 220 chars",
          html: "required HTML fragment or document; no scripts, event handlers, or javascript URLs",
        }
      : {
          name: "optional short template name",
          description: "optional admin-only description",
          subject: "required subject, max 180 chars",
          previewText: "optional inbox preview, max 220 chars",
          content: {
            eyebrow: "optional short eyebrow",
            heading: "required heading",
            intro: "optional intro line",
            sections: [
              {
                kind: "text or code",
                title: "optional section title",
                body: "required section copy",
              },
            ],
            cta: {
              label: "optional CTA label",
              url: "optional plain http(s) or mailto URL; Markdown link syntax is accepted and normalized",
            },
            footerNote: "optional footer note",
          },
        };

  return [
    "# MHacks Email Template Drafting Context (Beta)",
    "",
    "You are drafting a NEW email template for MHacks organizers using the current template as context. Return ONLY valid JSON. Do not include Markdown fences or commentary.",
    "",
    "Rules:",
    "- Keep the message concise and operational.",
    "- Use only the allowed merge fields listed below.",
    "- Merge fields must be written as {{field_name}}.",
    "- Do not invent applicant segments, audience sources, backend behavior, or sending rules.",
    "- Do not include scripts, event handlers, tracking pixels, external forms, or javascript URLs.",
    "- The imported draft will become a new local template; it will not overwrite the source template.",
    "- The organizer will review before saving or sending.",
    "",
    `Template type: ${template.type}`,
    `Allowed merge fields: ${allowedMergeFields.join(", ") || "none"}`,
    "",
    "Expected JSON shape:",
    JSON.stringify(draftSchema, null, 2),
    "",
    "Current template:",
    JSON.stringify(templateForAiContext(template), null, 2),
  ].join("\n");
}

function templateForAiContext(template: MasterTemplate) {
  return {
    name: template.name,
    type: template.type,
    description: template.description,
    subject: template.subject,
    previewText: template.previewText,
    content: template.content,
    html: template.html,
  };
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

  if (!Array.isArray(draft.sections) || draft.sections.length === 0) {
    throw new Error("AI draft content must include at least one section.");
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

function mergeTemplates(
  serverTemplates: MasterTemplate[],
  localTemplates: MasterTemplate[],
) {
  const byId = new Map<string, MasterTemplate>();
  for (const template of serverTemplates) {
    byId.set(template.id, template);
  }
  for (const template of localTemplates) {
    if (template.id.startsWith("seed-") && byId.has(template.id)) {
      continue;
    }
    byId.set(template.id, template);
  }
  return Array.from(byId.values());
}

function loadStoredTemplates() {
  return readStorage<MasterTemplate[]>(templatesStorageKey, []);
}

function storeTemplates(templates: MasterTemplate[]) {
  window.localStorage.setItem(templatesStorageKey, JSON.stringify(templates));
}

function loadStoredTheme() {
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
  window.localStorage.setItem(
    themeStorageVersionKey,
    currentThemeStorageVersion,
  );
  window.localStorage.setItem(themeStorageKey, JSON.stringify(theme));
}

function loadStoredSendStatus() {
  return readStorage<DirectSendStatus | null>(activeSendStatusStorageKey, null);
}

function storeSendStatus(status: DirectSendStatus) {
  window.localStorage.setItem(
    activeSendStatusStorageKey,
    JSON.stringify(status),
  );
}

function removeStoredSendStatus() {
  window.localStorage.removeItem(activeSendStatusStorageKey);
}

function loadStoredTestSendProof() {
  return readStorage<TestSendProof | null>(activeTestProofStorageKey, null);
}

function storeTestSendProof(proof: TestSendProof) {
  window.localStorage.setItem(activeTestProofStorageKey, JSON.stringify(proof));
}

function removeStoredTestSendProof() {
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
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
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
