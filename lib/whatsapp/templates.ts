import type { Locale } from "@/lib/i18n/locale";

/**
 * The WhatsApp messages ProCam sends about a booking, as WhatsApp "templates". WhatsApp only lets a business start a conversation with a
 * template it has approved in advance, so these are written once here and the admin copies each one into Meta's template manager
 * (Admin > WhatsApp shows the exact text and variables). Each template has the same name in all three languages (English, Malay, Chinese);
 * the language sent is the one the customer was using when they booked. They are all "Utility" messages about a booking they made.
 *
 * Variables are {{1}}, {{2}}... in the order of `variables`. Every template has one button, "View booking", that opens the customer's booking
 * page: its address is APP_URL/rent/b/{{1}} with the booking's secret token as the one variable.
 */
export type WaKind =
  | "BOOKING_CONFIRMED"
  | "PICKUP_REMINDER"
  | "HANDOVER_DONE"
  | "RETURN_REMINDER"
  | "LATE_NOTICE"
  | "DEPOSIT_CONFIRM"
  | "BOOKING_CANCELLED"
  | "WALKIN_PAID"
  | "SWAP_DONE"
  | "RETURN_DONE"
  | "RETURN_REVIEW"
  | "DEPOSIT_DECIDED";

export const WA_KINDS: WaKind[] = [
  "BOOKING_CONFIRMED",
  "WALKIN_PAID",
  "PICKUP_REMINDER",
  "HANDOVER_DONE",
  "SWAP_DONE",
  "RETURN_REMINDER",
  "LATE_NOTICE",
  "RETURN_DONE",
  "RETURN_REVIEW",
  "DEPOSIT_DECIDED",
  "DEPOSIT_CONFIRM",
  "BOOKING_CANCELLED",
];

/** The language codes WhatsApp uses for the three languages. */
export const WA_LANGUAGE_CODE: Record<Locale, string> = { en: "en", ms: "ms", zh: "zh_CN" };

export const WA_APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://procambooking.app";

export type WaTemplate = {
  kind: WaKind;
  /** The template name in Meta's template manager. */
  name: string;
  /** When it is sent, for the admin. */
  when: string;
  /** What {{1}}, {{2}}... stand for. */
  variables: string[];
  /** Sample values Meta asks for when a template is submitted. */
  examples: string[];
  body: Record<Locale, string>;
  button: Record<Locale, string>;
};

export const WA_TEMPLATES: Record<WaKind, WaTemplate> = {
  BOOKING_CONFIRMED: {
    kind: "BOOKING_CONFIRMED",
    name: "procam_booking_confirmed",
    when: "Right after the booking is paid.",
    variables: ["Customer name", "Booking number", "Shop name", "Pickup date and time"],
    examples: ["Aina", "DBK-00123", "Port Dickson", "16 Oct, 10:00"],
    body: {
      en: `Hi {{1}}, your ProCam Rental booking {{2}} is confirmed. Collect your drone at {{3}} on {{4}} and show the QR code on your booking page to the staff. New to flying? Watch the tutorial: ${WA_APP_URL}/tutorial`,
      ms: `Hai {{1}}, tempahan ProCam Rental anda {{2}} telah disahkan. Ambil dron anda di {{3}} pada {{4}} dan tunjukkan kod QR pada halaman tempahan anda kepada kakitangan. Baru belajar terbang? Tonton tutorial: ${WA_APP_URL}/tutorial`,
      zh: `您好 {{1}}，您的 ProCam Rental 预订 {{2}} 已确认。请于 {{4}} 到 {{3}} 取机，并向店员出示预订页面上的二维码。第一次飞？请观看教程：${WA_APP_URL}/tutorial`,
    },
    button: { en: "View booking", ms: "Lihat tempahan", zh: "查看预订" },
  },
  PICKUP_REMINDER: {
    kind: "PICKUP_REMINDER",
    name: "procam_pickup_reminder",
    when: "About an hour before the pickup time.",
    variables: ["Customer name", "Shop name", "Pickup time"],
    examples: ["Aina", "Port Dickson", "10:00"],
    body: {
      en: `Hi {{1}}, a reminder: you collect your ProCam drone at {{2}} at {{3}}. Bring your photo ID (MyKad or passport). A quick tutorial: ${WA_APP_URL}/tutorial`,
      ms: `Hai {{1}}, peringatan: anda mengambil dron ProCam anda di {{2}} pada {{3}}. Bawa MyKad atau pasport anda. Tutorial ringkas: ${WA_APP_URL}/tutorial`,
      zh: `您好 {{1}}，温馨提醒：您将在 {{3}} 到 {{2}} 取 ProCam 无人机。请带上您的 MyKad 或护照。简短教程：${WA_APP_URL}/tutorial`,
    },
    button: { en: "View booking", ms: "Lihat tempahan", zh: "查看预订" },
  },
  HANDOVER_DONE: {
    kind: "HANDOVER_DONE",
    name: "procam_handover_done",
    when: "When the staff hand over the drone.",
    variables: ["Customer name", "Return time", "Shop name"],
    examples: ["Aina", "11:00", "Port Dickson"],
    body: {
      en: `Hi {{1}}, enjoy your flight! Please bring the drone and all your batteries back to {{3}} by {{2}}. Battery finished? Open your booking, tap "Swap it at any shop" and swap at any of our shops. How to fly: ${WA_APP_URL}/tutorial`,
      ms: `Hai {{1}}, selamat terbang! Sila pulangkan dron dan semua bateri anda ke {{3}} sebelum {{2}}. Bateri habis? Buka tempahan anda, tekan "Tukar di mana-mana kedai" dan tukar di mana-mana kedai kami. Cara terbang: ${WA_APP_URL}/tutorial`,
      zh: `您好 {{1}}，祝您飞行愉快！请在 {{2}} 前把无人机和全部电池归还到 {{3}}。电池用完了？打开您的预订，点“可在任何门店更换”，到我们任何一家门店更换即可。飞行教程：${WA_APP_URL}/tutorial`,
    },
    button: { en: "View booking", ms: "Lihat tempahan", zh: "查看预订" },
  },
  RETURN_REMINDER: {
    kind: "RETURN_REMINDER",
    name: "procam_return_reminder",
    when: "About 15 minutes before the return time.",
    variables: ["Customer name", "Return time", "Shop name"],
    examples: ["Aina", "11:00", "Port Dickson"],
    body: {
      en: `Hi {{1}}, your ProCam drone is due back at {{2}}. Please bring the drone and all batteries to {{3}}. Late returns are charged the hourly rate for each hour. Need a fresh battery first? Swap it at any shop from your booking page.`,
      ms: `Hai {{1}}, dron ProCam anda perlu dipulangkan pada {{2}}. Sila bawa dron dan semua bateri ke {{3}}. Pemulangan lewat dicaj pada kadar sejam bagi setiap jam. Perlukan bateri baharu dahulu? Tukar di mana-mana kedai dari halaman tempahan anda.`,
      zh: `您好 {{1}}，您的 ProCam 无人机应在 {{2}} 归还。请把无人机和全部电池带到 {{3}}。逾期按每小时费率逐小时收费。需要先换电池？可在预订页面选择任意门店更换。`,
    },
    button: { en: "View booking", ms: "Lihat tempahan", zh: "查看预订" },
  },
  LATE_NOTICE: {
    kind: "LATE_NOTICE",
    name: "procam_late_notice",
    when: "After the return time and the grace period have passed.",
    variables: ["Customer name", "Return time", "Shop name"],
    examples: ["Aina", "11:00", "Port Dickson"],
    body: {
      en: `Hi {{1}}, your ProCam drone was due back at {{2}}. Please bring it and all batteries to {{3}} now: time after the grace period is charged at the hourly rate for each hour.`,
      ms: `Hai {{1}}, dron ProCam anda sepatutnya dipulangkan pada {{2}}. Sila bawa dron dan semua bateri ke {{3}} sekarang: masa selepas tempoh bertolak ansur dicaj pada kadar sejam bagi setiap jam.`,
      zh: `您好 {{1}}，您的 ProCam 无人机应在 {{2}} 归还。请现在把它和全部电池带到 {{3}}：宽限期之后的时间按每小时费率逐小时收费。`,
    },
    button: { en: "View booking", ms: "Lihat tempahan", zh: "查看预订" },
  },
  DEPOSIT_CONFIRM: {
    kind: "DEPOSIT_CONFIRM",
    name: "procam_deposit_confirm",
    when: "When the bank did not accept the automatic deposit hold.",
    variables: ["Customer name", "Booking number"],
    examples: ["Aina", "DBK-00123"],
    body: {
      en: `Hi {{1}}, your bank did not accept the deposit hold for booking {{2}}. The deposit is only a hold, not a charge. Please open your booking page and tap Confirm deposit before you collect the drone.`,
      ms: `Hai {{1}}, bank anda tidak menerima tahanan deposit untuk tempahan {{2}}. Deposit hanyalah tahanan, bukan caj. Sila buka halaman tempahan anda dan tekan Sahkan deposit sebelum anda mengambil dron.`,
      zh: `您好 {{1}}，您的银行没有接受预订 {{2}} 的押金冻结。押金只是冻结，不是扣款。请在取机前打开预订页面并点击“确认押金”。`,
    },
    button: { en: "Confirm deposit", ms: "Sahkan deposit", zh: "确认押金" },
  },
  BOOKING_CANCELLED: {
    kind: "BOOKING_CANCELLED",
    name: "procam_booking_cancelled",
    when: "When a paid booking loses the last drone to someone who paid first and is refunded.",
    variables: ["Customer name", "Booking number", "Amount refunded"],
    examples: ["Aina", "DBK-00123", "RM20"],
    body: {
      en: `Hi {{1}}, your booking {{2}} was cancelled because someone else paid for the last drone first, and {{3}} is being refunded to your card. Your bank may take 5 to 10 working days to show it. You can book another time at ${WA_APP_URL}`,
      ms: `Hai {{1}}, tempahan anda {{2}} dibatalkan kerana orang lain membayar untuk dron terakhir dahulu, dan {{3}} sedang dipulangkan ke kad anda. Bank anda mungkin mengambil masa 5 hingga 10 hari bekerja untuk menunjukkannya. Anda boleh menempah masa lain di ${WA_APP_URL}`,
      zh: `您好 {{1}}，您的预订 {{2}} 已取消，因为有人先为最后一架无人机付了款，{{3}} 正在退回您的银行卡。银行可能需要 5 至 10 个工作日才会显示。您可以在 ${WA_APP_URL} 预订其他时间。`,
    },
    button: { en: "View booking", ms: "Lihat tempahan", zh: "查看预订" },
  },
  WALKIN_PAID: {
    kind: "WALKIN_PAID",
    name: "procam_walkin_paid",
    when: "When a walk-in's payment is in (card, cash or a QR payment the merchant confirmed).",
    variables: ["Customer name", "Amount paid", "Booking number", "Shop name"],
    examples: ["Aina", "RM56", "DBK-00123", "Port Dickson"],
    body: {
      en: `Hi {{1}}, we received your payment of {{2}} for your walk-in rental {{3}} at {{4}}. The staff will hand over your drone now. The deposit is only a hold on your card, never deducted from your bank account.`,
      ms: `Hai {{1}}, kami telah menerima bayaran anda sebanyak {{2}} untuk sewaan walk-in anda {{3}} di {{4}}. Kakitangan akan menyerahkan dron anda sekarang. Deposit hanyalah tahanan pada kad anda, tidak pernah ditolak daripada akaun bank anda.`,
      zh: `您好 {{1}}，我们已收到您为现场租借 {{3}}（{{4}}）支付的 {{2}}。店员现在会把无人机交给您。押金只是卡上的冻结，不会从您的银行账户扣款。`,
    },
    button: { en: "View booking", ms: "Lihat tempahan", zh: "查看预订" },
  },
  SWAP_DONE: {
    kind: "SWAP_DONE",
    name: "procam_swap_done",
    when: "Each time a battery swap is done.",
    variables: ["Customer name", "Batteries swapped", "Shop name", "Fee paid", "Paid by"],
    examples: ["Aina", "1 battery", "Port Dickson", "RM8", "QR"],
    body: {
      en: `Hi {{1}}, your battery swap is done: {{2}} swapped at {{3}}, {{4}} paid by {{5}}. Remember to bring the drone and all your batteries back to the shop you rented from.`,
      ms: `Hai {{1}}, pertukaran bateri anda selesai: {{2}} ditukar di {{3}}, {{4}} dibayar dengan {{5}}. Ingat untuk memulangkan dron dan semua bateri anda ke kedai tempat anda menyewa.`,
      zh: `您好 {{1}}，您的电池更换已完成：在 {{3}} 更换了 {{2}}，{{4}} 已用{{5}}支付。请记得把无人机和全部电池归还到您租借的门店。`,
    },
    button: { en: "View booking", ms: "Lihat tempahan", zh: "查看预订" },
  },
  RETURN_DONE: {
    kind: "RETURN_DONE",
    name: "procam_return_done",
    when: "When the drone is returned in good order and the deposit hold is released.",
    variables: ["Customer name", "Deposit amount", "Shop name"],
    examples: ["Aina", "RM700", "Port Dickson"],
    body: {
      en: `Hi {{1}}, thank you for returning your ProCam drone at {{3}}. Everything is in good order, so your {{2}} deposit hold has been released. Nothing was deducted from your bank account. Your bank may take a few days to stop showing the hold.`,
      ms: `Hai {{1}}, terima kasih kerana memulangkan dron ProCam anda di {{3}}. Semuanya dalam keadaan baik, jadi tahanan deposit {{2}} anda telah dilepaskan. Tiada wang ditolak daripada akaun bank anda. Bank anda mungkin mengambil masa beberapa hari untuk berhenti memaparkan tahanan itu.`,
      zh: `您好 {{1}}，感谢您在 {{3}} 归还 ProCam 无人机。一切完好，您的 {{2}} 押金冻结已解除，没有从您的银行账户扣款。银行可能需要几天才会不再显示这笔冻结。`,
    },
    button: { en: "View booking", ms: "Lihat tempahan", zh: "查看预订" },
  },
  RETURN_REVIEW: {
    kind: "RETURN_REVIEW",
    name: "procam_return_review",
    when: "When the drone is returned with something damaged and the review is set for that night.",
    variables: ["Customer name", "Shop name"],
    examples: ["Aina", "Port Dickson"],
    body: {
      en: `Hi {{1}}, thank you for returning your ProCam drone at {{2}}. Something needs checking, so we will review it tonight. Your deposit stays held until then and we will message you with the result.`,
      ms: `Hai {{1}}, terima kasih kerana memulangkan dron ProCam anda di {{2}}. Ada sesuatu yang perlu disemak, jadi kami akan menyemaknya malam ini. Deposit anda kekal ditahan sehingga itu dan kami akan menghantar mesej tentang keputusannya.`,
      zh: `您好 {{1}}，感谢您在 {{2}} 归还 ProCam 无人机。有些地方需要检查，我们会在今晚处理。在此之前押金继续冻结，处理结果出来后我们会通知您。`,
    },
    button: { en: "View booking", ms: "Lihat tempahan", zh: "查看预订" },
  },
  DEPOSIT_DECIDED: {
    kind: "DEPOSIT_DECIDED",
    name: "procam_deposit_decided",
    when: "When the damage review (or a lost item at the return) has settled the deposit.",
    variables: ["Customer name", "Amount kept", "Amount released"],
    examples: ["Aina", "RM150", "RM550"],
    body: {
      en: `Hi {{1}}, we finished checking your returned drone. {{2}} was kept from your deposit and the remaining {{3}} was released. The details are on your booking page.`,
      ms: `Hai {{1}}, kami telah selesai menyemak dron yang anda pulangkan. {{2}} ditahan daripada deposit anda dan baki {{3}} telah dilepaskan. Butirannya ada pada halaman tempahan anda.`,
      zh: `您好 {{1}}，我们已检查完您归还的无人机。已从押金中扣留 {{2}}，其余 {{3}} 已解除冻结。详情请见您的预订页面。`,
    },
    button: { en: "View booking", ms: "Lihat tempahan", zh: "查看预订" },
  },
};

/** The button's address as it is registered in Meta's template manager: the booking page with a variable on the end. */
export const WA_BUTTON_URL = `${WA_APP_URL}/rent/b/{{1}}`;

/** Fills {{1}}, {{2}}... of a template body with values (what the customer will see; used for the preview and the dry run). */
export function fillTemplate(text: string, values: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_, n) => values[Number(n) - 1] ?? "");
}
