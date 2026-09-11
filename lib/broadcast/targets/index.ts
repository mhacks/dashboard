import { registerBroadcastTarget } from "@/lib/broadcast/registry";
import { hackerEmailTarget } from "@/lib/broadcast/targets/email-hacker";

// Register delivery channels here.
registerBroadcastTarget(hackerEmailTarget);
