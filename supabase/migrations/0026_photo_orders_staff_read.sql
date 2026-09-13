-- Staff (not just admin) need to read the print queue on
-- /staff/photo-orders and the worker route page — the actual status
-- writes go through the service-role client from server actions (same
-- dual-client pattern as app/staff/route/actions.ts), gated by
-- hasStaffAccess() at the application layer, so no staff write policy is
-- needed here.
create policy staff_read_photo_orders on photo_orders for select using (is_procam_staff());
create policy staff_read_photo_order_files on photo_order_files for select using (is_procam_staff());
