"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDefaultLayout, usePanelRef } from "react-resizable-panels";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Upload,
  X,
  Laptop,
  Smartphone,
} from "lucide-react";
import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
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
import { Input } from "@/components/ui/input";
import { panelLayoutStorage } from "@/hooks/panel-layout-storage";
import { useMediaQueryState } from "@/hooks/use-media-query";
import { useMounted } from "@/hooks/use-mounted";
import {
  buildAiTemplateContext,
  toAiDraftTemplateContext,
} from "@/lib/email/campaigns/ai-draft-context";
import { extractEmailMergeFields } from "@/lib/email/merge-fields";
import type { MasterTemplate } from "@/lib/email/templates/master-service";
import type {
  EmailAudienceQuery,
  EmailCampaignContent,
  EmailThemeTokens,
} from "@/lib/email/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  deleteEmailTemplateAction,
  findActiveDirectSendAction,
  generateEmailTemplateDraftAction,
  parseDirectRecipientsAction,
  renderEmailPreviewAction,
  resolveEmailAudienceAction,
  saveEmailThemeAction,
  sendDirectBatchAction,
  sendDirectTestEmailsAction,
  sendOneDirectEmailAction,
} from "./actions";
import { AiDraftPanel } from "./ai-draft-panel";
import { BuilderPanel } from "./builder-panel";
import {
  buildDirectSendTemplate,
  buildTestSendProofKey,
  delayUntil,
  downloadTextFile,
  ensureMergePreviewData,
  errorMessage,
  freshTestSendProof,
  isLocalDraftTemplateId,
  mergeSendFailures,
  parseAiTemplateDraft,
  persistTemplate,
  slugifyFilename,
} from "./campaign-helpers";
import {
  loadStoredSendRecipients,
  loadStoredSendStatus,
  loadStoredTestSendProof,
  loadStoredTheme,
  removeStoredSendRecipients,
  removeStoredSendStatus,
  removeStoredTestSendProof,
  storeSendRecipients,
  storeSendStatus,
  storeTestSendProof,
  storeTheme,
} from "./campaign-storage";
import {
  DESKTOP_LAYOUT_QUERY,
  EMAIL_WORKSPACE_PANEL_IDS,
  defaultAudienceQuery,
  type AudienceResolveResult,
  type CampaignLimits,
  type DirectSendStatus,
  type PreviewMode,
  type RecipientSaveResult,
  type RecipientSource,
  type SendJobSnapshot,
  type TestSendProof,
} from "./campaign-types";
import { PreviewButton, PreviewMergePanel } from "./preview-panel";
import { SendPanel } from "./send-panel";
import { StylesPanel } from "./styles-panel";
import { parseEmailCampaignView, type EmailCampaignSurface } from "./surface";
import { EmailCampaignWorkspaceHeader } from "./workspace-header";

export type { EmailCampaignSurface };

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
  const previewRequestIdRef = useRef(0);
  const [surface, setSurface] = useState<EmailCampaignSurface>(initialSurface);
  const [templates, setTemplates] =
    useState<MasterTemplate[]>(initialTemplates);
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
  const isDesktopLayout = useMediaQueryState(DESKTOP_LAYOUT_QUERY);
  const templatesPanelRef = usePanelRef();
  const panelLayout = useDefaultLayout({
    id: "email-campaign-workspace",
    panelIds: [...EMAIL_WORKSPACE_PANEL_IDS],
    storage: panelLayoutStorage,
  });

  useEffect(() => {
    if (!panelsMounted || isDesktopLayout !== true) {
      return;
    }

    setTemplatesPanelCollapsed(
      templatesPanelRef.current?.isCollapsed() ?? false,
    );
  }, [isDesktopLayout, panelsMounted, templatesPanelRef]);

  const [theme, setTheme] = useState<EmailThemeTokens>(initialTheme);
  const [mergePreviewData, setMergePreviewData] = useState<
    Record<string, string>
  >({});
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
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
    () => (selectedTemplate ? extractEmailMergeFields(selectedTemplate) : []),
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
    } catch {
      toast.error("Template could not be saved to the database.");
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
    } catch {
      toast.error("Styles could not be saved to the database.");
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
    } catch {
      const nextTemplates = [template, ...templates];
      setTemplates(nextTemplates);
      setSelectedTemplateId(template.id);
      clearSendStatus();
      toast.error("Upload kept as a local draft. Database save failed.");
    } finally {
      setBusy(null);
      if (uploadRef.current) {
        uploadRef.current.value = "";
      }
    }
  }

  function updateSelectedTemplate(patch: Partial<MasterTemplate>) {
    if (!selectedTemplate) return;
    replaceTemplate({
      ...selectedTemplate,
      ...patch,
    });
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
    } catch (error) {
      toast.error(errorMessage(error));
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
      );
      await window.navigator.clipboard.writeText(context);
    } catch {
      toast.error("Could not copy AI context.");
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
    } catch (error) {
      toast.error(errorMessage(error));
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
    } catch (error) {
      toast.error(errorMessage(error));
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

    const requestId = ++previewRequestIdRef.current;

    try {
      const rendered = await renderEmailPreviewAction(payload);
      if (previewRequestIdRef.current === requestId) {
        setPreviewHtml(rendered.html);
      }
    } catch {
      if (previewRequestIdRef.current === requestId) {
        setPreviewHtml("");
      }
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
    } catch (error) {
      toast.error(errorMessage(error));
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
    } catch (error) {
      toast.error(errorMessage(error));
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
      setSurface(
        parseEmailCampaignView(
          new URLSearchParams(window.location.search).get("view"),
        ),
      );
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
      Math.max(delayUntil(leaseExpiresAt, 250), 1000),
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
  const showTemplatesRail =
    isDesktopLayout === true && panelsMounted && templatesPanelCollapsed;

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
            <Input
              type="search"
              value={templateSearch}
              onChange={(event) => setTemplateSearch(event.target.value)}
              placeholder="Search templates"
              aria-label="Search templates"
              className="pl-9"
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
        limits={initialCampaignLimits}
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
        {isDesktopLayout === null ? (
          <div className="min-h-0 flex-1 border-t bg-card" />
        ) : isDesktopLayout ? (
          panelsMounted ? (
            <div className="flex min-h-0 flex-1 overflow-hidden border-t bg-card">
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
            <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(30rem,1fr)_420px] overflow-hidden border-t bg-card">
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
          )
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto border-t bg-card">
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
        )}
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
                  <Input
                    ref={templateSearchPopoverRef}
                    type="search"
                    value={templateSearch}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    placeholder="Search templates"
                    aria-label="Search templates"
                    className="pl-9"
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
