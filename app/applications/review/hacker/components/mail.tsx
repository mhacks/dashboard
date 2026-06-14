"use client"

import * as React from "react"
import {
  CheckCircle,
  Clock,
  Flag,
  Inbox,
  Search,
  Users2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AccountSwitcher } from "./account-switcher"
import { MailDisplay } from "./mail-display"
import { MailList } from "./mail-list"
import { Nav } from "./nav"
import { type Mail } from "../data"
import { useMail } from "../use-mail"
import { ReviewFormData } from "../raiting-criteria"

interface MailProps {
  accounts: {
    label: string
    email: string
    icon: React.ReactNode
  }[]
  mails: Mail[]
  defaultLayout: number[] | undefined
  defaultCollapsed?: boolean
  navCollapsedSize: number
}

export function Mail({
  accounts,
  mails: initialMails,
  defaultLayout = [20, 32, 48],
  defaultCollapsed = false,
  navCollapsedSize,
}: MailProps) {
  const [isCollapsed] = React.useState(false)
  const [mail, setMail] = useMail()
  const [mails, setMails] = React.useState<Mail[]>(initialMails)

  const pendingCount = mails.filter((m) => m.status === "pending").length
  const reviewedCount = mails.filter((m) => m.status === "reviewed").length
  const flaggedCount = mails.filter((m) => m.status === "flagged").length

  function handleReview(id: string, data: ReviewFormData) {
    const newStatus: Mail["status"] = data.flagForReview ? "flagged" : "reviewed"
    setMails((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, status: newStatus, read: true, labels: [newStatus] } : m
      )
    )
    // Auto-advance to next pending
    const next = mails.find((m) => m.id !== id && m.status === "pending")
    if (next) setMail((prev) => ({ ...prev, selected: next.id }))
  }

  return (
    <TooltipProvider delayDuration={0}>
      <ResizablePanelGroup
        orientation="horizontal"
        className="h-full max-h-[800px] items-stretch"
      >
        {/* Nav panel */}
        <ResizablePanel
          defaultSize={String(defaultLayout[0])}
          collapsedSize={String(navCollapsedSize)}
          collapsible={true}
          minSize="15"
          maxSize="20"
          className={cn(
            isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out"
          )}
        >
          <div
            className={cn(
              "flex h-[52px] items-center justify-center",
              isCollapsed ? "h-[52px]" : "px-2"
            )}
          >
            <AccountSwitcher isCollapsed={isCollapsed} accounts={accounts} />
          </div>
          <Separator />
          <Nav
            isCollapsed={isCollapsed}
            links={[
              {
                title: "All Applications",
                label: String(mails.length),
                icon: Inbox,
                variant: "default",
              },
              {
                title: "Pending",
                label: String(pendingCount),
                icon: Clock,
                variant: "ghost",
              },
              {
                title: "Reviewed",
                label: String(reviewedCount),
                icon: CheckCircle,
                variant: "ghost",
              },
              {
                title: "Flagged",
                label: String(flaggedCount),
                icon: Flag,
                variant: "ghost",
              },
            ]}
          />
          <Separator />
          <Nav
            isCollapsed={isCollapsed}
            links={[
              {
                title: "All Hackers",
                label: String(mails.length),
                icon: Users2,
                variant: "ghost",
              },
            ]}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* List panel */}
        <ResizablePanel defaultSize={String(defaultLayout[1])} minSize="30">
          <Tabs defaultValue="all">
            <div className="flex items-center px-4 py-2">
              <h1 className="text-xl font-bold">Applications</h1>
              <TabsList className="ml-auto">
                <TabsTrigger value="all" className="text-zinc-600 dark:text-zinc-200">
                  All
                </TabsTrigger>
                <TabsTrigger value="pending" className="text-zinc-600 dark:text-zinc-200">
                  Pending
                </TabsTrigger>
              </TabsList>
            </div>
            <Separator />
            <div className="bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <form>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search applicants..." className="pl-8" />
                </div>
              </form>
            </div>
            <TabsContent value="all" className="m-0">
              <MailList items={mails} />
            </TabsContent>
            <TabsContent value="pending" className="m-0">
              <MailList items={mails.filter((item) => !item.read)} />
            </TabsContent>
          </Tabs>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Display panel */}
        <ResizablePanel defaultSize={String(defaultLayout[2])}>
          <MailDisplay
            key={mail.selected ?? "none"}
            mail={mails.find((item) => item.id === mail.selected) ?? null}
            onReview={handleReview}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </TooltipProvider>
  )
}
