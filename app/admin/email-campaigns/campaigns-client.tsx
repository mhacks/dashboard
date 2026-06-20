"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Flower2,
  Laptop,
  ListChecks,
  Loader2,
  Moon,
  Palette,
  Play,
  Plus,
  Save,
  Send,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { defaultEmailTheme } from "@/lib/email/theme";
import type { EmailCampaignContent, EmailThemeTokens } from "@/lib/email/types";
import { cn } from "@/lib/utils";

type PreviewMode = "desktop" | "mobile";
type Surface = "builder" | "styles" | "send";
type TemplateType = "structured" | "html";
type ToastTone = "loading" | "success" | "error" | "info";

interface MasterTemplate {
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

interface DirectSendStatus {
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
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

interface ToastState {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

const templatesStorageKey = "mhacks-email-master-templates";
const themeStorageKey = "mhacks-email-active-theme";
const themeStorageVersionKey = "mhacks-email-active-theme-version";
const currentThemeStorageVersion = "m26-base-config";
const colorModeStorageKey = "mhacks-email-studio-dark-mode";

export default function EmailCampaignsClient() {
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [surface, setSurface] = useState<Surface>("builder");
  const [darkMode, setDarkMode] = useState(false);
  const [templates, setTemplates] = useState<MasterTemplate[]>([]);
  const [campaignLimits, setCampaignLimits] = useState<CampaignLimits>({
    maxRecipients: 2000,
    batchSize: 25,
    sendDelayMs: 100,
  });
  const [recipientText, setRecipientText] = useState("");
  const [recipientResult, setRecipientResult] =
    useState<RecipientSaveResult | null>(null);
  const [sendOneEmail, setSendOneEmail] = useState("");
  const [testEmails, setTestEmails] = useState("");
  const [sendNotice, setSendNotice] = useState("");
  const [sendStatus, setSendStatus] = useState<DirectSendStatus | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [theme, setTheme] = useState<EmailThemeTokens>(defaultEmailTheme);
  const [mergePreviewData, setMergePreviewData] = useState<
    Record<string, string>
  >({});
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [notice, setNotice] = useState("");
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
  const effectiveMergePreviewData = useMemo(
    () => ensureMergePreviewData(mergeFields, mergePreviewData),
    [mergeFields, mergePreviewData],
  );
  async function loadWorkspace() {
    setBusy("load");
    try {
      const [templateData, themeData, campaignData] = await Promise.all([
        api<{ templates: MasterTemplate[]; theme: EmailThemeTokens }>(
          "/api/admin/email/templates",
        ),
        api<{ theme: EmailThemeTokens }>("/api/admin/email/themes"),
        api<{
          limits: CampaignLimits;
        }>("/api/admin/email/campaigns"),
      ]);
      const localTemplates = loadStoredTemplates();
      const localTheme = loadStoredTheme();
      const nextTemplates = mergeTemplates(
        templateData.templates,
        localTemplates,
      );
      const nextTheme = localTheme ?? themeData.theme;

      setTemplates(nextTemplates);
      setTheme(nextTheme);
      setCampaignLimits(campaignData.limits);
      setSelectedTemplateId(nextTemplates[0]?.id ?? "");
    } catch {
      const fallbackTemplates = loadStoredTemplates();
      setTemplates(fallbackTemplates);
      setTheme(loadStoredTheme() ?? defaultEmailTheme);
      setSelectedTemplateId(fallbackTemplates[0]?.id ?? "");
    } finally {
      setBusy(null);
    }
  }

  async function saveTemplateToMaster() {
    if (!selectedTemplate) return;

    setBusy("save-template");
    try {
      const saved = await persistTemplate(selectedTemplate);
      replaceTemplate(saved);
      setNotice("Template saved.");
    } catch {
      storeTemplates(templates);
      setNotice("Template saved.");
    } finally {
      setBusy(null);
    }
  }

  async function saveStyles() {
    setBusy("save-styles");
    try {
      const data = await api<{ theme: EmailThemeTokens }>(
        "/api/admin/email/themes",
        {
          method: "POST",
          body: JSON.stringify(theme),
        },
      );
      setTheme(data.theme);
      storeTheme(data.theme);
      setNotice("Styles saved.");
    } catch {
      storeTheme(theme);
      setNotice("Styles saved.");
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
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", template.name);
      formData.append("description", template.description);
      formData.append("subject", template.subject);
      formData.append("previewText", template.previewText);

      const data = await api<{ template: MasterTemplate }>(
        "/api/admin/email/templates/upload-html",
        {
          method: "POST",
          body: formData,
          skipJsonHeader: true,
        },
      );
      const nextTemplates = [data.template, ...templates];
      setTemplates(nextTemplates);
      setSelectedTemplateId(data.template.id);
      storeTemplates(nextTemplates);
      setNotice("Template uploaded.");
    } catch {
      const nextTemplates = [template, ...templates];
      setTemplates(nextTemplates);
      setSelectedTemplateId(template.id);
      storeTemplates(nextTemplates);
      setNotice("Template uploaded.");
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

  function replaceTemplate(template: MasterTemplate) {
    const nextTemplates = templates.map((current) =>
      current.id === template.id ? template : current,
    );
    setTemplates(nextTemplates);
    storeTemplates(nextTemplates);
  }

  function deleteSelectedTemplate() {
    if (!selectedTemplate) return;
    const nextTemplates = templates.filter(
      (template) => template.id !== selectedTemplate.id,
    );
    setTemplates(nextTemplates);
    setSelectedTemplateId(nextTemplates[0]?.id ?? "");
    storeTemplates(nextTemplates);
    setNotice("Template removed.");
  }

  function toggleDarkMode() {
    setDarkMode((current) => {
      const next = !current;
      window.localStorage.setItem(colorModeStorageKey, String(next));
      return next;
    });
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
      setSendStatus(null);
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

    const emails = parseEmailList(testEmails);

    setBusy("test-send");
    setSendNotice(
      `Sending ${emails.length} test email${emails.length === 1 ? "" : "s"}...`,
    );
    showToast(
      "loading",
      "Sending test email",
      `${emails.length} test address${emails.length === 1 ? "" : "es"} queued.`,
    );
    try {
      const data = await api<{
        results: Array<{
          status: string;
          messageId: string | null;
          error: string | null;
        }>;
      }>("/api/admin/email/send/test", {
        method: "POST",
        body: JSON.stringify({
          template,
          emails,
          mergeData: effectiveMergePreviewData,
        }),
      });
      const sent = data.results.filter((result) => result.status === "sent");
      const firstFailure = data.results.find(
        (result) => result.status !== "sent",
      );
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
      setSendNotice(message);
      showToast("error", "Test send failed", message);
    } finally {
      setBusy(null);
    }
  }

  async function startFullSend() {
    const template = buildDirectSendTemplate(selectedTemplate, theme);
    if (!template) return;

    setBusy("start-send");
    setSendNotice("Sending...");
    showToast(
      "loading",
      "Sending list",
      "Starting the first server-throttled batch.",
    );
    try {
      let status: DirectSendStatus | null = null;
      let cursor = 0;
      let sentCount = 0;
      let failedCount = 0;
      let recentFailures: DirectSendStatus["recentFailures"] = [];

      for (let batch = 0; batch < 1000; batch += 1) {
        status = await api<DirectSendStatus>("/api/admin/email/send/start", {
          method: "POST",
          body: JSON.stringify({
            template,
            recipients: recipientText,
            cursor,
            sentCount,
            failedCount,
            recentFailures,
          }),
        });
        setSendStatus(status);
        showToast(
          "loading",
          "Sending list",
          `${status.sentCount} sent, ${status.failedCount} failed, ${status.pendingCount} pending.`,
        );
        cursor = status.nextCursor;
        sentCount = status.sentCount;
        failedCount = status.failedCount;
        recentFailures = status.recentFailures;

        if (status.complete) {
          break;
        }
      }

      setSendNotice(
        status
          ? `Send complete: ${status.sentCount} sent, ${status.failedCount} failed.`
          : "Send complete.",
      );
      showToast(
        status?.failedCount ? "error" : "success",
        "List send complete",
        status
          ? `${status.sentCount} sent, ${status.failedCount} failed.`
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

  function showToast(tone: ToastTone, title: string, description?: string) {
    setToast({
      id: Date.now(),
      tone,
      title,
      description,
    });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadWorkspace();
      setDarkMode(readStorage(colorModeStorageKey, false));
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

  const selectedSection =
    selectedTemplate?.content?.sections[selectedSectionIndex] ?? null;
  const previewWidth = previewMode === "desktop" ? 720 : 390;

  return (
    <main
      className={cn(
        "relative min-h-screen overflow-hidden transition-colors",
        darkMode
          ? "dark bg-[#0b0d08] text-zinc-50"
          : "bg-[#f7f7f2] text-zinc-950",
      )}
    >
      <Image
        src="/white_green_bg.png"
        alt=""
        fill
        className="pointer-events-none object-cover object-top opacity-[0.06] dark:opacity-[0.08]"
      />
      <div className="pointer-events-none absolute inset-0 bg-white/82 dark:bg-[#0b0d08]/88" />

      <section className="relative border-b border-black/10 bg-white/80 px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#11140d]/82 dark:shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-end justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                <Flower2 className="size-4" />
                MHacks Email Studio
              </div>
              <h1 className="font-heading mt-1 text-4xl leading-none italic text-[#3A4A26] sm:text-5xl dark:text-[#dce8b0]">
                Campaigns
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Build, tune, and preview reusable email templates.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(liquidDarkPillClass, "flex w-fit gap-1 p-1")}>
              <PillButton
                active={surface === "builder"}
                onClick={() => setSurface("builder")}
              >
                <FileText />
                Builder
              </PillButton>
              <PillButton
                active={surface === "styles"}
                onClick={() => setSurface("styles")}
              >
                <Palette />
                Styles
              </PillButton>
              <PillButton
                active={surface === "send"}
                onClick={() => setSurface("send")}
              >
                <Send />
                Send
              </PillButton>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title={darkMode ? "Light mode" : "Dark mode"}
              className={cn(liquidIconButtonClass, "size-11")}
              onClick={toggleDarkMode}
            >
              {darkMode ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>
      </section>

      <div className="relative mx-auto grid max-w-[1600px] gap-4 px-4 py-4 md:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_minmax(420px,0.9fr)]">
        <aside className="md:self-stretch">
          <section className={cn(liquidPanelClass, "p-4 md:sticky md:top-4")}>
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl italic text-[#3A4A26] dark:text-[#dce8b0]">
                Templates
              </h2>
              <Button
                variant="ghost"
                title="New template"
                className={cn(liquidLightButtonClass, "h-8 px-3")}
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
                liquidLightButtonClass,
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
                    setSelectedTemplateId(template.id);
                    setSelectedSectionIndex(0);
                  }}
                  className={`w-full rounded-[1.25rem] border p-3 text-left transition ${
                    selectedTemplateId === template.id
                      ? "border-[#44572199] bg-[#f4f7ee] shadow-[0_10px_28px_rgba(68,87,33,0.12)] dark:border-[#dce8b066] dark:bg-[#1b2213]"
                      : "border-black/10 bg-white hover:border-black/15 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20 dark:hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                      {template.name}
                    </p>
                    <span className="rounded-full border border-white/15 bg-black/[0.38] px-2 py-1 text-[10px] uppercase tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl dark:bg-white/10">
                      {template.type}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-300">
                    {template.description || template.subject}
                  </p>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className={cn(liquidPanelClass, "min-h-[740px] p-5")}>
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
              onDeleteTemplate={deleteSelectedTemplate}
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
              onThemeChange={setTheme}
              onSaveStyles={() => void saveStyles()}
            />
          ) : (
            <SendPanel
              selectedTemplate={selectedTemplate}
              limits={campaignLimits}
              recipientText={recipientText}
              recipientResult={recipientResult}
              sendOneEmail={sendOneEmail}
              testEmails={testEmails}
              sendStatus={sendStatus}
              notice={sendNotice}
              busy={busy}
              onRecipientTextChange={(value) => {
                setRecipientText(value);
                setRecipientResult(null);
                setSendStatus(null);
              }}
              onCheckRecipients={() => void checkRecipientList()}
              onSendOneEmailChange={setSendOneEmail}
              onSendOne={() => void sendOneRecipient()}
              onTestEmailsChange={setTestEmails}
              onTestSend={() => void sendTestEmails()}
              onStartSend={() => void startFullSend()}
            />
          )}
        </section>

        <section
          className={cn(liquidPanelClass, "p-4 md:col-span-2 2xl:col-span-1")}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-2xl italic text-[#3A4A26] dark:text-[#dce8b0]">
                Preview
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Live desktop/mobile preview.
              </p>
            </div>
            <div className={cn(liquidDarkPillClass, "flex gap-1 p-1")}>
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
          <div className="mt-4 overflow-auto rounded-[1.25rem] border border-black/10 bg-[#f7f7f4] p-4 dark:border-white/10 dark:bg-black/20">
            <div
              className="mx-auto overflow-hidden rounded-xl bg-white shadow-[0_18px_48px_rgba(0,0,0,0.14)]"
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
                <div className="flex h-[520px] items-center justify-center text-sm text-zinc-500">
                  Select a template to preview.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
      <ToastSnackbar toast={toast} onDismiss={() => setToast(null)} />
    </main>
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
  onDeleteTemplate,
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
  onDeleteTemplate: () => void;
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
      <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-dashed border-black/15 bg-white text-sm text-zinc-500 dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-400">
        Choose or create a master template.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            Template editor
          </p>
          <h2 className="font-heading text-3xl italic text-[#3A4A26] sm:text-4xl dark:text-[#dce8b0]">
            {selectedTemplate.name}
          </h2>
          {notice ? (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {notice}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            className={liquidDangerButtonClass}
            onClick={onDeleteTemplate}
          >
            <Trash2 />
            Remove
          </Button>
          <Button
            className={liquidDarkButtonClass}
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

      {selectedTemplate.type === "html" ? (
        <Field label="HTML template">
          <textarea
            className={`${textareaClass} font-mono text-xs`}
            rows={18}
            value={selectedTemplate.html ?? ""}
            onChange={(event) => onTemplateChange({ html: event.target.value })}
          />
        </Field>
      ) : selectedTemplate.content ? (
        <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
          <div className={cn(liquidInsetClass, "p-3")}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Blocks
              </p>
              <Button
                size="icon-sm"
                variant="ghost"
                className={liquidIconButtonClass}
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
                  className={`w-full rounded-[1rem] border p-3 text-left text-sm transition ${
                    selectedSectionIndex === index
                      ? "border-[#44572199] bg-white shadow-[0_10px_26px_rgba(68,87,33,0.1)] dark:border-[#dce8b066] dark:bg-[#1b2213]"
                      : "border-black/10 bg-transparent hover:bg-white dark:border-white/10 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <p className="truncate font-medium text-zinc-950 dark:text-zinc-100">
                    {section.title || `Block ${index + 1}`}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-300">
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
              <div className={cn(liquidInsetClass, "p-4")}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Selected block</p>
                  <div className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className={liquidMiniButtonClass}
                      onClick={() => onSectionMove(selectedSectionIndex, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className={liquidMiniButtonClass}
                      onClick={() => onSectionMove(selectedSectionIndex, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className={liquidMiniButtonClass}
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
    <section className={cn(liquidInsetClass, "p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Recipient data
          </p>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            Merge fields are recipient-list columns, not values to enter one by
            one. A future audience import should provide one row per recipient
            and one column for each field used here.
          </p>
        </div>
        <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300">
          {fields.length} required {fields.length === 1 ? "column" : "columns"}
        </span>
      </div>

      {fields.length > 0 ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Required mailing list columns
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {fields.map((field) => (
                <code key={field} className={codeClass}>
                  {field}
                </code>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              For a 2000 person list, this is handled once at import/send time:
              each CSV/database row supplies its own values for these columns.
            </p>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/[0.035]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Sample preview row
                </span>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Used only to render the preview on the right.
                </p>
              </div>
              <span className="rounded-full border border-black/10 px-3 py-1 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                1 recipient
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {fields.map((field) => (
                <label key={field} className="block space-y-2">
                  <span className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
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
        <p className="mt-3 rounded-xl border border-dashed border-black/10 bg-white px-3 py-2 text-sm text-zinc-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-zinc-400">
          This template does not require extra recipient columns yet.
        </p>
      )}
    </section>
  );
}

function SendPanel({
  selectedTemplate,
  limits,
  recipientText,
  recipientResult,
  sendOneEmail,
  testEmails,
  sendStatus,
  notice,
  busy,
  onRecipientTextChange,
  onCheckRecipients,
  onSendOneEmailChange,
  onSendOne,
  onTestEmailsChange,
  onTestSend,
  onStartSend,
}: {
  selectedTemplate: MasterTemplate | null;
  limits: CampaignLimits;
  recipientText: string;
  recipientResult: RecipientSaveResult | null;
  sendOneEmail: string;
  testEmails: string;
  sendStatus: DirectSendStatus | null;
  notice: string;
  busy: string | null;
  onRecipientTextChange: (value: string) => void;
  onCheckRecipients: () => void;
  onSendOneEmailChange: (value: string) => void;
  onSendOne: () => void;
  onTestEmailsChange: (value: string) => void;
  onTestSend: () => void;
  onStartSend: () => void;
}) {
  const sendRate = Math.floor(1000 / Math.max(1, limits.sendDelayMs));
  const templateCanSend = Boolean(
    selectedTemplate &&
    (selectedTemplate.type === "html" || selectedTemplate.content),
  );
  const validatedRecipients = recipientResult?.emails.length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            Direct send
          </p>
          <h2 className="font-heading text-3xl italic text-[#3A4A26] sm:text-4xl dark:text-[#dce8b0]">
            Send email
          </h2>
          {notice ? (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {notice}
            </p>
          ) : null}
        </div>
      </div>

      {!templateCanSend ? (
        <p className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
          Select a template with content before sending.
        </p>
      ) : null}

      <SendProgress busy={busy} sendStatus={sendStatus} />

      <section className={cn(liquidInsetClass, "p-4")}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Selected template
            </p>
            <p className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-100">
              {selectedTemplate?.name ?? "No template selected"}
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {selectedTemplate?.type === "html"
                ? "HTML template"
                : "Structured template"}
            </p>
          </div>
          <div className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Server limits
            </p>
            <p className="mt-1 text-zinc-700 dark:text-zinc-200">
              {limits.maxRecipients} max recipients
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
              value={sendStatus.complete ? "complete" : "sending"}
            />
            <Metric label="Recipients" value={sendStatus.totalRecipients} />
            <Metric label="Sent" value={sendStatus.sentCount} />
            <Metric label="Failed" value={sendStatus.failedCount} />
          </div>
        ) : null}
      </section>

      <section className={cn(liquidInsetClass, "p-4")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Recipients
            </p>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Paste emails or CSV with an{" "}
              <code className={codeClass}>email</code> column plus merge columns
              like <code className={codeClass}>name</code>.
            </p>
          </div>
          <Button
            variant="ghost"
            className={liquidLightButtonClass}
            disabled={!recipientText.trim() || Boolean(busy)}
            onClick={onCheckRecipients}
          >
            <Users />
            {busy === "check-recipients" ? "Checking..." : "Check list"}
          </Button>
        </div>
        <textarea
          className={cn(textareaClass, "mt-3 min-h-36 font-mono text-xs")}
          value={recipientText}
          onChange={(event) => onRecipientTextChange(event.target.value)}
          placeholder={
            "email,name,travel_reimbursement\nhacker@umich.edu,Hacker,150.00"
          }
        />
        {recipientResult ? (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <p className="rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.035]">
              {recipientResult.emails.length} valid
            </p>
            <p className="rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.035]">
              {recipientResult.duplicateCount} duplicates
            </p>
            <p className="rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.035]">
              {recipientResult.invalid.length} invalid
            </p>
          </div>
        ) : null}
      </section>

      <section className={cn(liquidInsetClass, "p-4")}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
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
                className={liquidDarkButtonClass}
                disabled={!templateCanSend || !sendOneEmail || Boolean(busy)}
                onClick={onSendOne}
              >
                <Send />
                {busy === "send-one" ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Test send
            </p>
            <div className="mt-2 flex gap-2">
              <input
                className={inputClass}
                value={testEmails}
                onChange={(event) => onTestEmailsChange(event.target.value)}
                placeholder="test1@email.com, test2@email.com"
              />
              <Button
                variant="ghost"
                className={liquidLightButtonClass}
                disabled={
                  !templateCanSend || !testEmails.trim() || Boolean(busy)
                }
                onClick={onTestSend}
              >
                <ListChecks />
                {busy === "test-send" ? "Sending..." : "Test"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className={cn(liquidInsetClass, "p-4")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Full list
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Sends in server-throttled batches. Keep this tab open while the
              list is running.
            </p>
            {sendStatus ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {sendStatus.pendingCount} pending, {sendStatus.sentCount} sent,{" "}
                {sendStatus.failedCount} failed
              </p>
            ) : validatedRecipients > 0 ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {validatedRecipients} checked recipients ready to send.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className={liquidDarkButtonClass}
              disabled={
                !templateCanSend || !recipientText.trim() || Boolean(busy)
              }
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
                className="rounded-xl border border-red-200/60 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-200/20 dark:bg-red-200/10 dark:text-red-100"
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
    <div className="rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.035]">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
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
    ? `${sendStatus.sentCount} sent, ${sendStatus.failedCount} failed, ${sendStatus.pendingCount} pending`
    : "Working on the server...";

  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-[#44572133] bg-[#f4f7ee] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-[#dce8b033] dark:bg-[#dce8b0]/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {busy ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-[#445721] dark:text-[#dce8b0]" />
          ) : (
            <CheckCircle2 className="size-4 shrink-0 text-[#445721] dark:text-[#dce8b0]" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {title}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {detail}
            </p>
          </div>
        </div>
        {progress !== null ? (
          <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-white/10 dark:bg-white/[0.07] dark:text-zinc-200">
            {progress}%
          </span>
        ) : null}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={cn(
            "h-full rounded-full bg-[#445721] transition-all duration-500 dark:bg-[#dce8b0]",
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
      ? "border-red-500 bg-red-600 text-white shadow-[0_28px_80px_rgba(185,28,28,0.38)] dark:border-red-300 dark:bg-red-500 dark:text-white"
      : toast.tone === "success"
        ? "border-[#44572144] bg-[#f4f7ee] text-zinc-950 dark:border-[#dce8b044] dark:bg-[#dce8b0]/12 dark:text-zinc-50"
        : "border-black/10 bg-white text-zinc-950 dark:border-white/10 dark:bg-[#151910] dark:text-zinc-50";

  return (
    <div
      className={cn(
        "fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-[1.25rem] border-2 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur-2xl md:left-auto md:right-5 md:mx-0",
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
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-current opacity-70" />
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-full p-1 opacity-75 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
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
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            Email styling
          </p>
          <h2 className="font-heading text-4xl italic text-[#3A4A26] dark:text-[#dce8b0]">
            Styles
          </h2>
        </div>
        <Button
          className={liquidDarkButtonClass}
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
            className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.035)] transition hover:border-[#44572166] dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-[#dce8b066]"
          >
            <input
              type="color"
              value={String(theme[key])}
              onChange={(event) =>
                onThemeChange({ ...theme, [key]: event.target.value })
              }
              className="size-10 rounded-xl border border-black/10 bg-transparent dark:border-white/15"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
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
      <Field label="Font stack">
        <input
          className={inputClass}
          value={theme.fontFamily}
          onChange={(event) =>
            onThemeChange({ ...theme, fontFamily: event.target.value })
          }
        />
      </Field>
    </div>
  );
}

function PillButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all [&_svg]:size-4 ${
        active
          ? "border-white/70 bg-white/78 text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
          : "border-transparent text-white/78 hover:border-white/20 hover:bg-white/[0.12] hover:text-white"
      }`}
    >
      {children}
    </button>
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
      className={`flex size-9 items-center justify-center rounded-full border transition-all [&_svg]:size-4 ${
        active
          ? "border-white/70 bg-white/78 text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
          : "border-transparent text-white/78 hover:border-white/20 hover:bg-white/[0.12] hover:text-white"
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
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
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
  };

  if (template.id.startsWith("seed-") || template.id.startsWith("local-")) {
    const data = await api<{ template: MasterTemplate }>(
      "/api/admin/email/templates",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return data.template;
  }

  const data = await api<{ template: MasterTemplate }>(
    `/api/admin/email/templates/${template.id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  return data.template;
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

function defaultMergeValue(field: string) {
  const samples: Record<string, string> = {
    email: "hacker@mhacks.org",
    expires_in: "10 minutes",
    first_name: "Hacker",
    name: "Hacker",
    otp_code: "123456",
    travel_reimbursement: "150.00",
  };

  return samples[field] ?? `Sample ${field.replaceAll("_", " ")}`;
}

function parseEmailList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,;\t ]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
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

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const liquidPanelClass =
  "rounded-[1.5rem] border border-black/10 bg-white/95 shadow-[0_18px_48px_rgba(0,0,0,0.07)] backdrop-blur-xl dark:border-white/10 dark:bg-[#11140d]/95 dark:shadow-[0_18px_52px_rgba(0,0,0,0.32)]";

const liquidInsetClass =
  "rounded-[1.25rem] border border-black/10 bg-[#f7f7f4] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/[0.035] dark:shadow-none";

const liquidDarkPillClass =
  "rounded-full border border-white/15 bg-black/[0.38] shadow-[0_8px_32px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.22)] backdrop-blur-2xl";

const liquidLightButtonClass =
  "h-10 rounded-full border border-black/10 bg-white px-4 text-zinc-800 shadow-[0_8px_22px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all hover:border-[#44572166] hover:bg-[#f6f8ef] hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-100 dark:shadow-none dark:hover:border-[#dce8b066] dark:hover:bg-white/[0.1] dark:hover:text-white";

const liquidDarkButtonClass =
  "h-10 rounded-full border border-white/15 bg-black/[0.42] px-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,0,0,0.2)] backdrop-blur-2xl transition-all hover:bg-black/[0.54] hover:text-white";

const liquidDangerButtonClass =
  "h-10 rounded-full border border-black/10 bg-white px-4 text-zinc-700 shadow-[0_8px_22px_rgba(0,0,0,0.05)] transition-all hover:border-black/20 hover:bg-zinc-50 hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200 dark:shadow-none dark:hover:border-white/20 dark:hover:bg-white/[0.09] dark:hover:text-white";

const liquidIconButtonClass =
  "rounded-full border border-black/10 bg-white text-zinc-800 shadow-[0_8px_22px_rgba(0,0,0,0.05)] hover:border-[#44572166] hover:bg-[#f6f8ef] hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-100 dark:shadow-none dark:hover:border-[#dce8b066] dark:hover:bg-white/[0.1] dark:hover:text-white";

const liquidMiniButtonClass =
  "rounded-full border border-black/10 bg-white text-zinc-600 hover:border-[#44572166] hover:bg-[#f6f8ef] hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-300 dark:hover:border-[#dce8b066] dark:hover:bg-white/[0.1] dark:hover:text-white";

const codeClass =
  "rounded-md border border-black/10 bg-white px-1.5 py-0.5 font-mono text-xs text-zinc-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200";

const inputClass =
  "h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus-visible:border-[#3A4A26] focus-visible:ring-3 focus-visible:ring-[#3A4A26]/15 dark:border-white/10 dark:bg-white/[0.055] dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus-visible:border-[#dce8b0] dark:focus-visible:ring-[#dce8b0]/15";

const textareaClass =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-zinc-400 focus-visible:border-[#3A4A26] focus-visible:ring-3 focus-visible:ring-[#3A4A26]/15 dark:border-white/10 dark:bg-white/[0.055] dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus-visible:border-[#dce8b0] dark:focus-visible:ring-[#dce8b0]/15";
