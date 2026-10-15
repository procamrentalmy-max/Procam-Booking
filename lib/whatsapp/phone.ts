/**
 * A phone number as WhatsApp wants it: country code and number, digits only, no plus (Malaysia: 60123456789).
 * Customers type it many ways: "+60 12-345 6789", "012-345 6789", "60123456789". Returns null when it can't be a mobile number.
 */
export function toWhatsAppNumber(phone: string, defaultCountry = "60"): string | null {
  let digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return null;
  if (phone.trim().startsWith("00")) digits = digits.slice(2); // 0060... written as an international prefix
  else if (digits.startsWith("0")) digits = defaultCountry + digits.slice(1); // a local number: 012... becomes 6012...
  // Malaysian numbers: 60 then 9 to 11 digits (1x-xxxxxxx mobiles are 9 or 10). Anything else is left as typed if it looks international.
  if (digits.startsWith(defaultCountry)) return digits.length >= 11 && digits.length <= 13 ? digits : null;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}
