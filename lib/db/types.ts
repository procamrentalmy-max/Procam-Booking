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
export type PickupMethod = "RECEPTION" | "LOCKER";
export type StaffRole = "PROCAM_STAFF" | "ADMIN";
export type IdentityVerificationMethod = "WHATSAPP_OTP" | "SMS_OTP";
export type IdentityVerificationStatus = "PENDING" | "VERIFIED" | "FAILED";

/** Lifecycle status shared by every rental product's physical inventory (camera, SeaLife housing, ...). */
export type AssetStatus =
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

export type PaymentKind = "RENTAL_FEE" | "LATE_FEE" | "DAMAGE_FEE";
export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
export type DepositStatus = "AUTHORIZED" | "RELEASED" | "CAPTURED" | "PARTIALLY_CAPTURED" | "VOIDED" | "EXPIRED";

export type ConditionCheckType = "PRE_RENTAL" | "RETURN";
export type CheckPhase = "PRE_RENTAL" | "RETURN" | "STAFF_INSPECTION";
export type CheckInputType = "PHOTO" | "BOOLEAN";

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
  | "OTHER"
  | "HOUSING_CRACK"
  | "OPTICAL_WINDOW_DAMAGE"
  | "SEAL_ORING_FAILURE"
  | "LOCKING_LATCH_DAMAGE"
  | "VACUUM_SYSTEM_FAULT"
  | "MOISTURE_LEAK_DETECTED"
  | "CORROSION_SALT_DAMAGE"
  | "HOUSING_MISSING";
export type DamageCaseStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED";
export type DepositAction = "NONE" | "CAPTURED" | "PARTIALLY_CAPTURED";

export type MaintainableAssetType = "RENTAL_ASSET" | "BATTERY";
export type TrackedAssetType = "RENTAL_ASSET" | "BATTERY";
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
  pickup_method: PickupMethod;
  created_at: string;
  updated_at: string;
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
  stripe_customer_id: string | null;
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

export type ProductPhoneCompatibilityRow = {
  id: string;
  product_id: string;
  manufacturer: string;
  model: string;
  variant: string | null;
  compatible: boolean;
  notes: string | null;
  created_at: string;
};

export type ProductInstructionRow = {
  id: string;
  product_id: string;
  step_number: number;
  title: string;
  body: string;
  created_at: string;
};

export type ProductTermsVersionRow = {
  id: string;
  product_id: string;
  version: number;
  body: string;
  effective_at: string;
  active: boolean;
  created_at: string;
};

export type BookingAcknowledgementRow = {
  id: string;
  booking_id: string;
  terms_version_id: string;
  agreed_at: string;
};

export type RentalProductRow = {
  id: string;
  slug: string;
  internal_name: string;
  customer_facing_name: string;
  tagline: string | null;
  description: string | null;
  asset_prefix: string;
  uses_batteries: boolean;
  requires_phone_compatibility: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type RentalPackageRow = {
  id: string;
  product_id: string;
  name: string;
  duration_minutes: number;
  price_myr: number;
  deposit_myr: number;
  late_fee_per_hour_myr: number;
  active: boolean;
  is_overnight: boolean;
  created_at: string;
  updated_at: string;
};

export type RentalAssetRow = {
  id: string;
  human_id: string;
  product_id: string;
  model: string;
  serial_number: string;
  partner_id: string | null;
  status: AssetStatus;
  notes: string | null;
  is_hot_spare: boolean;
  created_at: string;
  updated_at: string;
};

export type LockerRow = {
  id: string;
  human_id: string;
  partner_id: string;
  compartment_count: number;
  created_at: string;
  updated_at: string;
};

export type LockerCompartmentRow = {
  id: string;
  locker_id: string;
  compartment_number: number;
  current_pin: string | null;
  current_asset_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkerRow = {
  id: string;
  staff_user_id: string;
  current_partner_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkerLockerAssignmentRow = {
  worker_id: string;
  partner_id: string;
  created_at: string;
};

export type LocationTravelTimeRow = {
  id: string;
  from_partner_id: string;
  to_partner_id: string;
  minutes: number;
  created_at: string;
  updated_at: string;
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
  dropoff_partner_id: string;
  rental_package_id: string;
  asset_id: string;
  battery_id: string | null;
  status: BookingStatus;
  start_time: string;
  end_time: string;
  actual_pickup_time: string | null;
  actual_return_time: string | null;
  late_fee_myr: number;
  rating: number | null;
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

export type CheckTemplateRow = {
  id: string;
  product_id: string;
  phase: CheckPhase;
  item_key: string;
  label: string;
  instruction: string | null;
  input_type: CheckInputType;
  sort_order: number;
  required: boolean;
  active: boolean;
  created_at: string;
};

export type ConditionCheckRow = {
  id: string;
  booking_id: string;
  asset_id: string;
  type: ConditionCheckType;
  performed_at: string;
  acknowledgements: Record<string, boolean>;
  damage_reported: boolean;
  damage_description: string | null;
  created_at: string;
};

export type ConditionPhotoRow = {
  id: string;
  condition_check_id: string;
  check_template_item_id: string;
  storage_path: string;
  created_at: string;
};

export type InspectionRow = {
  id: string;
  booking_id: string;
  asset_id: string;
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
  asset_id: string | null;
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
      staff_users: TableDef<StaffUserRow>;
      customers: TableDef<CustomerRow>;
      identity_verifications: TableDef<IdentityVerificationRow>;
      rental_products: TableDef<RentalProductRow>;
      product_phone_compatibility: TableDef<ProductPhoneCompatibilityRow>;
      check_templates: TableDef<CheckTemplateRow>;
      product_instructions: TableDef<ProductInstructionRow>;
      product_terms_versions: TableDef<ProductTermsVersionRow>;
      booking_acknowledgements: TableDef<BookingAcknowledgementRow>;
      rental_packages: TableDef<RentalPackageRow>;
      rental_assets: TableDef<RentalAssetRow>;
      lockers: TableDef<LockerRow>;
      locker_compartments: TableDef<LockerCompartmentRow>;
      workers: TableDef<WorkerRow>;
      worker_locker_assignments: TableDef<WorkerLockerAssignmentRow>;
      location_travel_times: TableDef<LocationTravelTimeRow>;
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
      transition_asset_status: {
        Args: {
          p_asset_id: string;
          p_to_status: AssetStatus;
          p_event_type?: string | null;
          p_booking_id?: string | null;
          p_metadata?: Record<string, unknown>;
        };
        Returns: RentalAssetRow;
      };
      system_transition_asset_status: {
        Args: {
          p_asset_id: string;
          p_to_status: AssetStatus;
          p_actor_type: ActorType;
          p_actor_id?: string | null;
          p_event_type?: string | null;
          p_booking_id?: string | null;
          p_metadata?: Record<string, unknown>;
        };
        Returns: RentalAssetRow;
      };
      create_locker_booking_atomic: {
        Args: {
          p_customer_id: string;
          p_partner_id: string;
          p_dropoff_partner_id: string;
          p_rental_package_id: string;
          p_asset_id: string;
          p_start_time: string;
          p_end_time: string;
          p_secure_token: string;
          p_source: BookingSource;
          p_referral_code?: string | null;
        };
        Returns: BookingRow;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
