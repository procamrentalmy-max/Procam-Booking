import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inputClass, primaryButtonClass, dangerButtonClass } from "@/components/formStyles";
import { getProductImageUrl } from "@/lib/storage";
import {
  createProductAction,
  updateProductAction,
  updateProductImageAction,
  removeProductImageAction,
} from "./actions";

const CATEGORIES = [
  { value: "DRONE", label: "Drone" },
  { value: "CAMERA", label: "Camera" },
] as const;

export default async function ProductsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: products } = await supabase.from("rental_products").select("*").order("created_at", { ascending: true });

  return (
    <div className="space-y-6 pt-4">
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">New Product</h2>
        <form action={createProductAction} className="grid gap-2 sm:grid-cols-2">
          <input name="slug" placeholder="Slug, e.g. sealife-sportdiver-ultra" required className={inputClass} />
          <input name="assetPrefix" placeholder="Asset prefix, e.g. SDU" required className={inputClass} />
          <input name="internalName" placeholder="Internal name" required className={inputClass} />
          <input name="customerFacingName" placeholder="Customer-facing name" required className={inputClass} />
          <input name="tagline" placeholder="Tagline (optional)" className={`${inputClass} sm:col-span-2`} />
          <select name="category" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Category…
            </option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="usesBatteries" /> Uses ProCam batteries
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requiresPhoneCompatibility" /> Requires phone compatibility check
          </label>
          <button type="submit" className={`${primaryButtonClass} sm:col-span-2`}>
            Create Product
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {(products ?? []).map((product) => (
          <div key={product.id} className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="font-medium">
              {product.internal_name} <span className="text-sm text-zinc-500">({product.asset_prefix}-xxx)</span>
            </p>

            <div className="flex items-center gap-4">
              {product.image_path ? (
                // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local asset
                <img
                  src={getProductImageUrl(product.image_path)}
                  alt=""
                  className="h-20 w-20 rounded-lg border border-zinc-200 object-cover dark:border-zinc-800"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-xs text-zinc-400 dark:border-zinc-700">
                  No picture
                </div>
              )}
              <form action={updateProductImageAction} className="flex flex-1 flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={product.id} />
                <input type="file" name="image" accept="image/png,image/jpeg,image/webp" required className="text-sm" />
                <button type="submit" className={primaryButtonClass}>
                  Upload
                </button>
              </form>
              {product.image_path && (
                <form action={removeProductImageAction}>
                  <input type="hidden" name="id" value={product.id} />
                  <button type="submit" className={dangerButtonClass}>
                    Remove
                  </button>
                </form>
              )}
            </div>

            <form action={updateProductAction} className="grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="id" value={product.id} />
              <input name="customerFacingName" defaultValue={product.customer_facing_name} className={inputClass} />
              <input name="tagline" defaultValue={product.tagline ?? ""} placeholder="Tagline" className={inputClass} />
              <select name="category" defaultValue={product.category} className={inputClass}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="usesBatteries" defaultChecked={product.uses_batteries} /> Uses ProCam
                batteries
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="requiresPhoneCompatibility"
                  defaultChecked={product.requires_phone_compatibility}
                />{" "}
                Requires phone compatibility check
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={product.active} /> Active
              </label>
              <button type="submit" className={primaryButtonClass}>
                Save
              </button>
            </form>
            {product.requires_phone_compatibility && (
              <Link
                href={`/admin/products/${product.id}/phone-compatibility`}
                className="inline-block text-sm underline underline-offset-2"
              >
                Manage phone compatibility
              </Link>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
