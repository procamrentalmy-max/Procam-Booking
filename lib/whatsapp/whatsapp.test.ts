import { describe, expect, it } from "vitest";
import { chooseChannel } from "./channel";
import { toWhatsAppNumber } from "./phone";
import { WA_KINDS, WA_TEMPLATES, fillTemplate } from "./templates";

describe("a customer's phone number as WhatsApp wants it", () => {
  it("turns the ways Malaysians write a number into country code plus number", () => {
    expect(toWhatsAppNumber("+60 12-345 6789")).toBe("60123456789");
    expect(toWhatsAppNumber("012-345 6789")).toBe("60123456789");
    expect(toWhatsAppNumber("0123456789")).toBe("60123456789");
    expect(toWhatsAppNumber("60123456789")).toBe("60123456789");
    expect(toWhatsAppNumber("0060123456789")).toBe("60123456789");
    expect(toWhatsAppNumber("(+60) 17-978 4866")).toBe("60179784866");
  });
  it("keeps a plausible international number and rejects rubbish", () => {
    expect(toWhatsAppNumber("+65 9123 4567")).toBe("6591234567");
    expect(toWhatsAppNumber("")).toBeNull();
    expect(toWhatsAppNumber("abc")).toBeNull();
    expect(toWhatsAppNumber("012")).toBeNull();
  });
});

describe("the WhatsApp templates", () => {
  const vars = (text: string) => [...new Set([...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort();
  it("have the same variables in English, Malay and Chinese, matching the list the admin sees", () => {
    for (const kind of WA_KINDS) {
      const t = WA_TEMPLATES[kind];
      const wanted = t.variables.map((_, i) => i + 1);
      expect(vars(t.body.en), kind + " en").toEqual(wanted);
      expect(vars(t.body.ms), kind + " ms").toEqual(wanted);
      expect(vars(t.body.zh), kind + " zh").toEqual(wanted);
      expect(t.examples.length, kind + " examples").toBe(t.variables.length);
    }
  });
  it("have unique names and a button label in every language", () => {
    const names = WA_KINDS.map((k) => WA_TEMPLATES[k].name);
    expect(new Set(names).size).toBe(names.length);
    for (const k of WA_KINDS) for (const l of ["en", "ms", "zh"] as const) expect(WA_TEMPLATES[k].button[l].length).toBeGreaterThan(0);
  });
  it("fills the variables in order", () => {
    expect(fillTemplate("Hi {{1}}, {{2}} at {{3}}", ["Aina", "DBK-1", "Kajang"])).toBe("Hi Aina, DBK-1 at Kajang");
  });
  it("keep the body within what WhatsApp allows (1024 characters)", () => {
    for (const k of WA_KINDS) for (const l of ["en", "ms", "zh"] as const) expect(WA_TEMPLATES[k].body[l].length).toBeLessThan(1024);
  });
});

describe("which channel a booking's messages go by", () => {
  it("uses WhatsApp whenever a WhatsApp number was given, to that number rather than the phone number", () => {
    expect(chooseChannel({ whatsappNumber: "+60 17-978 4866", whatsappOptIn: false, phone: "012-345 6789" })).toEqual({ channel: "WHATSAPP", to: "60179784866" });
    expect(chooseChannel({ whatsappNumber: "  0198765432 ", whatsappOptIn: true, phone: "012-345 6789" })).toEqual({ channel: "WHATSAPP", to: "60198765432" });
  });
  it("texts the phone number when the WhatsApp number is empty", () => {
    expect(chooseChannel({ whatsappNumber: null, whatsappOptIn: false, phone: "+60 12-345 6789" })).toEqual({ channel: "SMS", to: "60123456789" });
    expect(chooseChannel({ whatsappNumber: "   ", whatsappOptIn: false, phone: "012-345 6789" })).toEqual({ channel: "SMS", to: "60123456789" });
  });
  it("keeps what older bookings chose: ticking the old box meant WhatsApp to the phone number", () => {
    expect(chooseChannel({ whatsappNumber: null, whatsappOptIn: true, phone: "012-345 6789" })).toEqual({ channel: "WHATSAPP", to: "60123456789" });
  });
  it("has no number to send to when the phone number cannot be a mobile number", () => {
    expect(chooseChannel({ whatsappNumber: null, whatsappOptIn: false, phone: "123" }).to).toBeNull();
  });
});
