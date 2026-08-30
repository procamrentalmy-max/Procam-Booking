/**
 * Hand-authored types mirroring supabase/migrations/0001_init.sql.
 *
 * Once a real Supabase project exists, replace this file with generated
 * types instead of maintaining it by hand:
 *
 *   npx supabase gen types typescript --project-id <ref> > lib/db/types.ts
 *
 * Row types are kept accurate to the schema. Insert/Update are intentionally
 * loose (Partial<Row>) rather than hand-modeling every nullable/defaulted
 * column twice — swap in generated types to tighten this.
 *
 * Row shapes below are `type` aliases, not `interface`s: postgrest-js's
 * generic query typing requires each table's Row/Insert/Update to
 * structurally satisfy `Record<string, unknown>`, which only object type
 * literals do — an `interface` doesn't get the implicit index signature and
 * silently collapses every query result to `never`.
 */

export type PartnerStatus = "ACTIVE" | "INACTIVE";
export type StaffRole = "PROCAM_STAFF" | "ADMIN";
export type IdentityVerificationMethod = "WHATSAPP_OTP" | "SMS_OTP";
export type IdentityVerificationStatus = "PENDING" | "VERIFIED" | "FAILED";

export type CameraStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "READY_FOR_PICKUP"
  | "RENTED"
  | "RETURNED_AWAITING_INSPECTION"
  | "INSPECTION"
  | "CLEANING"
  | "CHARGING"
  | "MAINTENANCE"
  | "LOST"
  | "RETIRED";

export type KitStatus = "AVAILABLE" | "WITH_CUSTOMER" | "AWAITING_INSPECTION" | "MAINTENANCE" | "RETIRED";
export type BatteryStatus = "CHARGED" | "DEPLOYED" | "CHARGING" | "MAINTENANCE" | "LOST" | "RETIRED";

export type BookingStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "READY_FOR_PICKUP"
  | "ACTIVE"
  | "RETURN_STARTED"
  | "AWAITING_INSPECTION"
  | "INSPECTION"
  | "DAMAGE_REVIEW"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

export type PaymentKind = "RENTAL_FEE";
export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
export type DepositStatus = "AUTHORIZED" | "RELEASED" | "CAPTURED" | "PARTIALLY_CAPTURED" | "VOIDED" | "EXPIRED";

export type ConditionCheckType = "PRE_RENTAL" | "RETURN";
export type ConditionPhotoType = "SCREEN_ON" | "LENS_A" | "LENS_B" | "KIT_FULL";

export type InspectionResult = "PASS" | "DAMAGE";
export type DamageCategory =
  | "LENS_SCRATCH"
  | "SEVERE_LENS_DAMAGE"
  | "SCREEN_DAMAGE"
  | "BODY_DAMAGE"
  | "WATER_DAMAGE"
  | "MISSING_ACCESSORY"
  | "MISSING_BATTERY"
  | "CAMERA_MISSING"
  | "FUNCTIONALITY_ISSUE"
  | "OTHER";
export type DamageCaseStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED";
export type DepositAction = "NONE" | "CAPTURED" | "PARTIALLY_CAPTURED";

export type MaintainableAssetType = "CAMERA" | "BATTERY";
export type TrackedAssetType = "CAMERA" | "BATTERY" | "KIT";
export type ActorType = "CUSTOMER" | "RECEPTION" | "STAFF" | "ADMIN" | "SYSTEM";
export type NotificationChannel = "EMAIL" | "WHATSAPP" | "SMS";
export type NotificationStatus = "PENDING" | "SENT" | "FAILED";
export type BookingSource = "PARTNER_QR" | "WALK_IN" | "AFFILIATE" | "OTHER";
export type CommissionStatus = "ACCRUED" | "PAID";

export type PartnerRow = {
  id: string;
  human_id: string;
  name: string;
  address: string;
  commission_rate: number;
  referral_code: string;
  status: PartnerStatus;
  created_at: string;
  updated_at: string;
};

export type PartnerUserRow = {
  id: string;
  partner_id: string;
  auth_user_id: string;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
};

export type StaffUserRow = {
  id: string;
  auth_user_id: string;
  name: string;
  role: StaffRole;
  active: boolean;
  created_at: string;
};

export type CustomerRow = {
  id: string;
  human_id: string;
  name: string;
  phone: string;
  email: string;
  created_at: string;
};

export type IdentityVerificationRow = {
  id: string;
  customer_id: string;
  method: IdentityVerificationMethod;
  otp_code_hash: string | null;
  otp_expires_at: string | null;
  otp_attempts: number;
  id_document_photo_path: string | null;
  otp_verified_at: string | null;
  status: IdentityVerificationStatus;
  created_at: string;
};

export type RentalPackageRow = {
  id: string;
  name: string;
  duration_minutes: number;
  price_myr: number;
  deposit_myr: number;
  late_fee_per_hour_myr: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CameraRow = {
  id: string;
  human_id: string;
  model: string;
  serial_number: string;
  partner_id: string | null;
  status: CameraStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type KitRow = {
  id: string;
  human_id: string;
  partner_id: string | null;
  status: KitStatus;
  created_at: string;
  updated_at: string;
};

export type KitItemRow = {
  id: string;
  kit_id: string;
  item_name: string;
};

export type BatteryRow = {
  id: string;
  human_id: string;
  partner_id: string | null;
  status: BatteryStatus;
  created_at: string;
  updated_at: string;
};

export type BookingRow = {
  id: string;
  human_id: string;
  secure_token: string;
  customer_id: string;
  partner_id: string;
  rental_package_id: string;
  camera_id: string;
  kit_id: string;
  battery_id: string | null;
  status: BookingStatus;
  start_time: string;
  end_time: string;
  actual_pickup_time: string | null;
  actual_return_time: string | null;
  source: BookingSource;
  referral_code: string | null;
  created_at: string;
  updated_at: string;
};

export type BatteryExchangeRow = {
  id: string;
  booking_id: string;
  old_battery_id: string;
  new_battery_id: string;
  partner_id: string;
  performed_by_partner_user_id: string | null;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  booking_id: string;
  kind: PaymentKind;
  provider: string;
  provider_ref: string;
  amount_myr: number;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
};

export type DepositAuthorizationRow = {
  id: string;
  booking_id: string;
  provider: string;
  provider_ref: string;
  amount_myr: number;
  status: DepositStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type ConditionCheckRow = {
  id: string;
  booking_id: string;
  camera_id: string;
  type: ConditionCheckType;
  performed_at: string;
  ack_powers_on: boolean;
  ack_no_damage: boolean;
  ack_accessories_present: boolean;
  damage_reported: boolean;
  damage_description: string | null;
  created_at: string;
};

export type ConditionPhotoRow = {
  id: string;
  condition_check_id: string;
  photo_type: ConditionPhotoType;
  storage_path: string;
  created_at: string;
};

export type InspectionRow = {
  id: string;
  booking_id: string;
  camera_id: string;
  inspector_staff_id: string;
  result: InspectionResult;
  checklist: Record<string, unknown>;
  notes: string | null;
  created_at: string;
};

export type DamageCaseRow = {
  id: string;
  inspection_id: string;
  booking_id: string;
  category: DamageCategory;
  description: string;
  status: DamageCaseStatus;
  resolution_notes: string | null;
  deposit_action: DepositAction;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DamageCasePhotoRow = {
  id: string;
  damage_case_id: string;
  storage_path: string;
  created_at: string;
};

export type MaintenanceRow = {
  id: string;
  asset_type: MaintainableAssetType;
  camera_id: string | null;
  battery_id: string | null;
  description: string;
  started_at: string;
  completed_at: string | null;
  staff_id: string;
};

export type CommissionRow = {
  id: string;
  booking_id: string;
  partner_id: string;
  rental_amount_myr: number;
  rate: number;
  commission_amount_myr: number;
  status: CommissionStatus;
  paid_at: string | null;
  created_at: string;
};

export type AssetEventRow = {
  id: string;
  asset_type: TrackedAssetType;
  asset_id: string;
  booking_id: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string;
  actor_type: ActorType;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  actor_type: ActorType;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  customer_id: string | null;
  booking_id: string | null;
  channel: NotificationChannel;
  template: string;
  status: NotificationStatus;
  sent_at: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

type TableDef<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      partners: TableDef<PartnerRow>;
      partner_users: TableDef<PartnerUserRow>;
      staff_users: TableDef<StaffUserRow>;
      customers: TableDef<CustomerRow>;
      identity_verifications: TableDef<IdentityVerificationRow>;
      rental_packages: TableDef<RentalPackageRow>;
      cameras: TableDef<CameraRow>;
      kits: TableDef<KitRow>;
      kit_items: TableDef<KitItemRow>;
      batteries: TableDef<BatteryRow>;
      bookings: TableDef<BookingRow>;
      battery_exchanges: TableDef<BatteryExchangeRow>;
      payments: TableDef<PaymentRow>;
      deposit_authorizations: TableDef<DepositAuthorizationRow>;
      condition_checks: TableDef<ConditionCheckRow>;
      condition_photos: TableDef<ConditionPhotoRow>;
      inspections: TableDef<InspectionRow>;
      damage_cases: TableDef<DamageCaseRow>;
      damage_case_photos: TableDef<DamageCasePhotoRow>;
      maintenance: TableDef<MaintenanceRow>;
      commissions: TableDef<CommissionRow>;
      asset_events: TableDef<AssetEventRow>;
      audit_logs: TableDef<AuditLogRow>;
      notifications: TableDef<NotificationRow>;
    };
    Views: Record<string, never>;
    Functions: {
      transition_camera_status: {
        Args: {
          p_camera_id: string;
          p_to_status: CameraStatus;
          p_event_type?: string | null;
          p_booking_id?: string | null;
          p_metadata?: Record<string, unknown>;
        };
        Returns: CameraRow;
      };
      system_transition_camera_status: {
        Args: {
          p_camera_id: string;
          p_to_status: CameraStatus;
          p_actor_type: ActorType;
          p_actor_id?: string | null;
          p_event_type?: string | null;
          p_booking_id?: string | null;
          p_metadata?: Record<string, unknown>;
        };
        Returns: CameraRow;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
