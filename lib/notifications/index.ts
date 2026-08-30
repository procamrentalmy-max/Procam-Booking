import "server-only";
import type { NotificationProvider } from "./provider";
import { ConsoleNotificationProvider } from "./console";
import { ResendNotificationProvider } from "./resend";

export type { NotificationProvider } from "./provider";

export function getNotificationProvider(): NotificationProvider {
  return process.env.RESEND_API_KEY ? new ResendNotificationProvider() : new ConsoleNotificationProvider();
}
