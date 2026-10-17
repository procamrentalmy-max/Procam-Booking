/** What a new merchant's shop says until the admin fills in its real address (Admin > Staff > Edit info). Such a shop is kept closed to customers. */
export const SHOP_ADDRESS_PLACEHOLDER = "Address to be added";

/** Whether a shop has the details customers need to find it: a real address and a position on the map. */
export function shopInfoComplete(shop: { address: string; lat: number; lng: number }): boolean {
  return shop.address.trim() !== "" && shop.address !== SHOP_ADDRESS_PLACEHOLDER && !(shop.lat === 0 && shop.lng === 0);
}
