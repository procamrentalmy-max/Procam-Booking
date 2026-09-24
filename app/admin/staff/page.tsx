import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { emailToUsername } from "@/lib/auth/username";
import { createStaffAction, setStaffActiveAction, updateWorkerLockersAction } from "./actions";
import { EditLoginForm } from "./EditLoginForm";

export default async function StaffAdminPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: staff }, { data: workers }, { data: lockers }, { data: assignments }] = await Promise.all([
    supabase.from("staff_users").select("id,auth_user_id,name,role,active,created_at").order("created_at", { ascending: true }),
    supabase.from("workers").select("id,staff_user_id"),
    supabase.from("partners").select("id,name").eq("pickup_method", "LOCKER").eq("status", "ACTIVE").order("name"),
    supabase.from("worker_locker_assignments").select("worker_id,partner_id"),
  ]);

  const workerByStaffId = new Map((workers ?? []).map((w) => [w.staff_user_id, w]));
  const assignedPartnerIdsByWorkerId = new Map<string, Set<string>>();
  for (const a of assignments ?? []) {
    if (!assignedPartnerIdsByWorkerId.has(a.worker_id)) assignedPartnerIdsByWorkerId.set(a.worker_id, new Set());
    assignedPartnerIdsByWorkerId.get(a.worker_id)!.add(a.partner_id);
  }

  const { data: usersPage } = await createServiceRoleClient().auth.admin.listUsers();
  const emailByAuthId = new Map(usersPage?.users.map((u) => [u.id, u.email]));

  return (
    <div className="space-y-6 pt-4">
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">Add Staff</h2>
        <form action={createStaffAction} className="grid gap-2 sm:grid-cols-2">
          <input name="name" placeholder="Full name" required className={inputClass} />
          <input
            name="username"
            placeholder="Username"
            required
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9][-A-Za-z0-9._]*[A-Za-z0-9]"
            className={inputClass}
          />
          <input
            name="password"
            type="password"
            placeholder="Password (min 8 characters)"
            minLength={8}
            required
            className={inputClass}
          />
          <select name="role" defaultValue="PROCAM_STAFF" className={inputClass}>
            <option value="PROCAM_STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
            <option value="DRONE_MERCHANT">Drone Merchant</option>
          </select>
          <button type="submit" className={`${primaryButtonClass} sm:col-span-2`}>
            Create Account
          </button>
        </form>
        <p className="mt-2 text-xs text-zinc-500">
          Share the username and password with them directly. Workers don&apos;t manage their own login — use
          &quot;Edit Login&quot; below to change a worker&apos;s username or password later.
        </p>
      </section>

      <section className="space-y-3">
        {(staff ?? []).map((s) => {
          const email = emailByAuthId.get(s.auth_user_id) ?? "";
          const username = emailToUsername(email);
          const mode: "username" | "email" = username ? "username" : "email";
          const identifier = username ?? email;

          return (
            <div key={s.id} className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-black dark:text-zinc-50">
                    {s.name}{" "}
                    <span className="text-zinc-400">
                      — {s.role === "ADMIN" ? "Admin" : s.role === "DRONE_MERCHANT" ? "Drone Merchant" : "Staff"}
                    </span>
                  </p>
                  <p className="text-sm text-zinc-500">
                    {mode === "username" ? `Username: ${identifier}` : identifier || "—"}
                  </p>
                </div>
                <form action={setStaffActiveAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="active" value={(!s.active).toString()} />
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.active
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {s.active ? "Active" : "Deactivated"}
                  </span>
                  <button type="submit" className={primaryButtonClass}>
                    {s.active ? "Deactivate" : "Reactivate"}
                  </button>
                </form>
              </div>

              <EditLoginForm id={s.id} authUserId={s.auth_user_id} mode={mode} initialIdentifier={identifier} />

              {(() => {
                const worker = workerByStaffId.get(s.id);
                if (!worker) return null;
                const assignedIds = assignedPartnerIdsByWorkerId.get(worker.id) ?? new Set<string>();
                return (
                  <details>
                    <summary className="cursor-pointer text-sm text-zinc-500 underline underline-offset-2">
                      Assigned Lockers
                    </summary>
                    {/*
                      Keyed on the assignment set itself: the outer row's key
                      (s.id) never changes across a save, so without this
                      React reuses the same checkbox DOM nodes and never
                      re-applies defaultChecked from fresh server data.
                    */}
                    <form
                      key={[...assignedIds].sort().join(",")}
                      action={updateWorkerLockersAction}
                      className="mt-2 space-y-2"
                    >
                      <input type="hidden" name="workerId" value={worker.id} />
                      <div className="flex flex-wrap gap-3">
                        {(lockers ?? []).map((locker) => (
                          <label key={locker.id} className="flex items-center gap-1 text-sm">
                            <input
                              type="checkbox"
                              name="partnerIds"
                              value={locker.id}
                              defaultChecked={assignedIds.has(locker.id)}
                            />
                            {locker.name}
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-zinc-400">
                        None checked = covers every locker (default). Check specific lockers to limit their route to
                        just those.
                      </p>
                      <button type="submit" className={primaryButtonClass}>
                        Save Lockers
                      </button>
                    </form>
                  </details>
                );
              })()}
            </div>
          );
        })}
      </section>
    </div>
  );
}
