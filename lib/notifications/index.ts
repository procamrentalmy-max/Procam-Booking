import "server-only";
import type { NotificationProvider } from "./provider";
import { ConsoleNotificationProvider } from "./console";
import { WhatsAppCloudProvider } from "./whatsapp";

export type { NotificationProvider } from "./provider";

export function getNotificationProvider(): NotificationProvider {
  return process.env.WHATSAPP_ACCESS_TOKEN ? new WhatsAppCloudProvider() : new ConsoleNotificationProvider();
}
