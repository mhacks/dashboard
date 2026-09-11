import { registerBroadcastTarget } from "@/lib/broadcast/registry";
import { hackerEmailTarget } from "@/lib/broadcast/targets/email-hacker";

// Register each delivery channel here. Future targets (webhooks, push, etc.)
// implement BroadcastTarget and are added with registerBroadcastTarget().
registerBroadcastTarget(hackerEmailTarget);
