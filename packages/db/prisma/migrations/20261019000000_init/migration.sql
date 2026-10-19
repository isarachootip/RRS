-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "public"."DataScope" AS ENUM ('ALL', 'TEAM', 'OWN');

-- CreateEnum
CREATE TYPE "public"."OwnerStatus" AS ENUM ('NEW', 'CONTACTED', 'LISTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."AssetCategory" AS ENUM ('CONDO', 'HOUSE', 'TOWNHOME', 'APARTMENT_UNIT', 'APARTMENT_BUILDING', 'FACTORY', 'WAREHOUSE', 'LAND', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "public"."OwnershipType" AS ENUM ('OWNER', 'AGENT');

-- CreateEnum
CREATE TYPE "public"."RoomType" AS ENUM ('STUDIO', 'ONE_BEDROOM', 'TWO_BEDROOMS', 'THREE_BEDROOMS', 'PENTHOUSE', 'DUPLEX', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."AssetStatus" AS ENUM ('AVAILABLE', 'VIEWING_SCHEDULED', 'NEGOTIATING', 'BOOKED', 'CONTRACTED', 'SOLD', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('RENT', 'SALE');

-- CreateEnum
CREATE TYPE "public"."AssetAgentRole" AS ENUM ('LISTING', 'CO_AGENT');

-- CreateEnum
CREATE TYPE "public"."AgreementStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "public"."ListingStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."LeadIntent" AS ENUM ('RENT', 'BUY');

-- CreateEnum
CREATE TYPE "public"."LeadSource" AS ENUM ('FACEBOOK', 'WEBSITE', 'LINE', 'REFERRAL', 'PHONE', 'WALK_IN', 'PROPERTY_PORTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'VIEWING', 'NEGOTIATING', 'BOOKED', 'CONTRACTED', 'CLOSED_WON', 'LOST', 'CANCELLED', 'UNDECIDED');

-- CreateEnum
CREATE TYPE "public"."DealRole" AS ENUM ('FINDER', 'LISTING', 'SHOWING', 'CLOSER', 'COMPANY');

-- CreateEnum
CREATE TYPE "public"."CollaboratorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ActivityType" AS ENUM ('CALL', 'CHAT', 'EMAIL', 'NOTE', 'MEETING', 'FOLLOW_UP', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "public"."FollowUpOutcome" AS ENUM ('LIKED', 'NEGOTIATING_PRICE', 'WANTS_OTHER_UNITS', 'CONSIDERING', 'NOT_INTERESTED', 'AGREED');

-- CreateEnum
CREATE TYPE "public"."AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ContractStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'ENDED', 'TERMINATED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "public"."PartyType" AS ENUM ('TENANT', 'CO_TENANT', 'OCCUPANT', 'GUARANTOR');

-- CreateEnum
CREATE TYPE "public"."SaleStage" AS ENUM ('INTERESTED', 'OFFERED', 'DEPOSIT_PAID', 'SPA_SIGNED', 'LOAN_PENDING', 'TRANSFERRED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."FeePayer" AS ENUM ('BUYER', 'SELLER', 'SPLIT');

-- CreateEnum
CREATE TYPE "public"."PaymentType" AS ENUM ('BOOKING_FEE', 'SECURITY_DEPOSIT', 'ADVANCE_RENT', 'MONTHLY_RENT', 'SALE_DEPOSIT', 'SALE_PAYMENT', 'COMMISSION_FROM_OWNER', 'OTHER_INCOME', 'REFUND');

-- CreateEnum
CREATE TYPE "public"."PaymentDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'PROMPTPAY', 'CHEQUE', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."RentScheduleStatus" AS ENUM ('DUE', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "public"."ExpenseCategory" AS ENUM ('COMMON_FEE', 'REPAIR', 'UTILITY', 'PROPERTY_TAX', 'INSURANCE', 'CLEANING', 'MARKETING', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."CommissionFormula" AS ENUM ('ONE_MONTH', 'PERCENT_TOTAL', 'N_MONTHS', 'FIXED', 'CUSTOM', 'PERCENT_SALE_PRICE');

-- CreateEnum
CREATE TYPE "public"."CommissionStatus" AS ENUM ('PENDING_CALC', 'PENDING_REVIEW', 'APPROVED', 'AWAITING_OWNER_PAYMENT', 'RECEIVED', 'AWAITING_PAYOUT', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ShareType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "public"."PayoutStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'LINE');

-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('CREATE', 'UPDATE', 'ARCHIVE', 'RESTORE', 'APPROVE', 'REJECT', 'TRANSFER', 'STATUS_CHANGE', 'EXPORT', 'VIEW_SENSITIVE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "nickname" TEXT,
    "phone" TEXT,
    "team_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_freelance" BOOLEAN NOT NULL DEFAULT false,
    "totp_secret" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "line_user_id" TEXT,
    "notification_prefs" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by_id" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."teams" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "manager_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "scope" "public"."DataScope" NOT NULL DEFAULT 'ALL',

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "public"."user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "public"."owners" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "is_company" BOOLEAN NOT NULL DEFAULT false,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "line_id" TEXT,
    "email" TEXT,
    "source_channel" "public"."LeadSource",
    "first_contact_at" DATE,
    "agent_id" UUID,
    "status" "public"."OwnerStatus" NOT NULL DEFAULT 'NEW',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by_id" UUID,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "developer" TEXT,
    "address" TEXT,
    "district" TEXT,
    "province" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "near_transit" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."buildings" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "project_id" UUID,
    "owner_id" UUID NOT NULL,
    "address" TEXT,
    "total_floors" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."assets" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "category" "public"."AssetCategory" NOT NULL,
    "ownership_type" "public"."OwnershipType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "project_id" UUID,
    "building_id" UUID,
    "tower" TEXT,
    "unit_no" TEXT,
    "floor" INTEGER,
    "address" TEXT,
    "district" TEXT,
    "province" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "area_sqm" DECIMAL(10,2),
    "room_type" "public"."RoomType",
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "furniture" TEXT,
    "appliances" TEXT[],
    "pet_allowed" BOOLEAN NOT NULL DEFAULT false,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "listing_urls" TEXT[],
    "rent_price" DECIMAL(14,2),
    "min_rent_price" DECIMAL(14,2),
    "sale_price" DECIMAL(14,2),
    "min_sale_price" DECIMAL(14,2),
    "for_rent" BOOLEAN NOT NULL DEFAULT true,
    "for_sale" BOOLEAN NOT NULL DEFAULT false,
    "available_from" DATE,
    "status" "public"."AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "primary_agent_id" UUID,
    "internal_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by_id" UUID,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."asset_agents" (
    "asset_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "public"."AssetAgentRole" NOT NULL DEFAULT 'CO_AGENT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_agents_pkey" PRIMARY KEY ("asset_id","user_id")
);

-- CreateTable
CREATE TABLE "public"."asset_media" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."listing_agreements" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "transaction_type" "public"."TransactionType" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "commission_formula" "public"."CommissionFormula" NOT NULL,
    "commission_params" JSONB NOT NULL DEFAULT '{}',
    "exclusive" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."AgreementStatus" NOT NULL DEFAULT 'ACTIVE',
    "file_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "listing_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."listings" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "type" "public"."TransactionType" NOT NULL,
    "status" "public"."ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "slug" TEXT NOT NULL,
    "title_th" TEXT NOT NULL,
    "title_en" TEXT,
    "description_th" TEXT,
    "description_en" TEXT,
    "price" DECIMAL(14,2) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."leads" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "intent" "public"."LeadIntent" NOT NULL DEFAULT 'RENT',
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "line_id" TEXT,
    "email" TEXT,
    "nationality" TEXT,
    "budget_min" DECIMAL(14,2),
    "budget_max" DECIMAL(14,2),
    "preferred_location" TEXT,
    "preferred_project_id" UUID,
    "preferred_category" "public"."AssetCategory",
    "preferred_room_type" "public"."RoomType",
    "min_area_sqm" DECIMAL(10,2),
    "occupants" INTEGER,
    "move_in_date" DATE,
    "lease_months" INTEGER,
    "pet_required" BOOLEAN NOT NULL DEFAULT false,
    "special_note" TEXT,
    "source" "public"."LeadSource" NOT NULL,
    "source_listing_id" UUID,
    "owner_agent_id" UUID NOT NULL,
    "status" "public"."LeadStatus" NOT NULL DEFAULT 'NEW',
    "status_reason" TEXT,
    "last_activity_at" TIMESTAMPTZ(6),
    "next_follow_up_at" TIMESTAMPTZ(6),
    "consent_at" TIMESTAMPTZ(6),
    "consent_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by_id" UUID,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lead_assignments" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "from_user_id" UUID,
    "to_user_id" UUID NOT NULL,
    "assigned_by_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lead_collaborators" (
    "lead_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "public"."DealRole" NOT NULL,
    "status" "public"."CollaboratorStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(6),

    CONSTRAINT "lead_collaborators_pkey" PRIMARY KEY ("lead_id","user_id","role")
);

-- CreateTable
CREATE TABLE "public"."activities" (
    "id" UUID NOT NULL,
    "type" "public"."ActivityType" NOT NULL,
    "lead_id" UUID,
    "owner_id" UUID,
    "asset_id" UUID,
    "appointment_id" UUID,
    "body" TEXT NOT NULL,
    "outcome" "public"."FollowUpOutcome",
    "next_follow_up_at" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lead_offers" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "offered_by_id" UUID NOT NULL,
    "offered_price" DECIMAL(14,2),
    "note" TEXT,
    "share_token" TEXT,
    "share_expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."appointments" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "lead_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "location" TEXT,
    "agent_id" UUID NOT NULL,
    "coordinator_id" UUID,
    "coordinator_name" TEXT,
    "coordinator_phone" TEXT,
    "status" "public"."AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "rescheduled_from_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."appointment_items" (
    "appointment_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "outcome" "public"."FollowUpOutcome",
    "outcome_note" TEXT,

    CONSTRAINT "appointment_items_pkey" PRIMARY KEY ("appointment_id","asset_id")
);

-- CreateTable
CREATE TABLE "public"."bookings" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "lead_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "monthly_rent" DECIMAL(14,2) NOT NULL,
    "booking_fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "security_deposit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "advance_rent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paid_at" TIMESTAMPTZ(6),
    "received_by_id" UUID,
    "cancel_reason" TEXT,
    "fee_forfeited" BOOLEAN,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contracts" (
    "id" UUID NOT NULL,
    "contract_no" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "revision_of_id" UUID,
    "previous_contract_id" UUID,
    "booking_id" UUID,
    "asset_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "monthly_rent" DECIMAL(14,2) NOT NULL,
    "security_deposit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "advance_rent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "public"."ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "signed_at" TIMESTAMPTZ(6),
    "terminated_at" DATE,
    "termination_reason" TEXT,
    "reminder_days" INTEGER[] DEFAULT ARRAY[90, 60, 30]::INTEGER[],
    "commission_formula" "public"."CommissionFormula",
    "commission_params" JSONB NOT NULL DEFAULT '{}',
    "file_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contract_parties" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "party_type" "public"."PartyType" NOT NULL,
    "full_name" TEXT NOT NULL,
    "id_number" TEXT,
    "phone" TEXT,
    "email" TEXT,

    CONSTRAINT "contract_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sale_deals" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "lead_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "stage" "public"."SaleStage" NOT NULL DEFAULT 'INTERESTED',
    "asking_price" DECIMAL(14,2),
    "offered_price" DECIMAL(14,2),
    "agreed_price" DECIMAL(14,2),
    "deposit_amount" DECIMAL(14,2),
    "spa_signed_at" DATE,
    "transfer_date" DATE,
    "transfer_fee_payer" "public"."FeePayer",
    "loan_bank" TEXT,
    "commission_formula" "public"."CommissionFormula",
    "commission_params" JSONB NOT NULL DEFAULT '{}',
    "cancel_reason" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "sale_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" UUID NOT NULL,
    "type" "public"."PaymentType" NOT NULL,
    "direction" "public"."PaymentDirection" NOT NULL DEFAULT 'IN',
    "amount" DECIMAL(14,2) NOT NULL,
    "paid_at" TIMESTAMPTZ(6) NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "reference" TEXT,
    "asset_id" UUID,
    "booking_id" UUID,
    "contract_id" UUID,
    "sale_deal_id" UUID,
    "rent_schedule_id" UUID,
    "commission_id" UUID,
    "received_by_id" UUID,
    "proof_file_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by_id" UUID,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rent_schedules" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "amount_due" DECIMAL(14,2) NOT NULL,
    "amount_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "public"."RentScheduleStatus" NOT NULL DEFAULT 'DUE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rent_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."expenses" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "category" "public"."ExpenseCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "incurred_at" DATE NOT NULL,
    "paid_at" DATE,
    "vendor" TEXT,
    "proof_file_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."commissions" (
    "id" UUID NOT NULL,
    "contract_id" UUID,
    "sale_deal_id" UUID,
    "asset_id" UUID NOT NULL,
    "ownership_type" "public"."OwnershipType" NOT NULL,
    "formula" "public"."CommissionFormula" NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "base_amount" DECIMAL(14,2) NOT NULL,
    "term_months" INTEGER,
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "public"."CommissionStatus" NOT NULL DEFAULT 'PENDING_CALC',
    "current_revision" INTEGER NOT NULL DEFAULT 1,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "owner_payment_due_at" DATE,
    "received_at" TIMESTAMPTZ(6),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."commission_splits" (
    "id" UUID NOT NULL,
    "commission_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "role" "public"."DealRole" NOT NULL,
    "user_id" UUID,
    "share_type" "public"."ShareType" NOT NULL,
    "share_percent" DECIMAL(5,2),
    "amount" DECIMAL(14,2) NOT NULL,
    "withholding_tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(14,2) NOT NULL,
    "payout_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."commission_revisions" (
    "id" UUID NOT NULL,
    "commission_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),

    CONSTRAINT "commission_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."commission_payouts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "period_label" TEXT NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "status" "public"."PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMPTZ(6),
    "method" "public"."PaymentMethod",
    "proof_file_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "commission_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."files" (
    "id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "entity_type" TEXT,
    "entity_id" UUID,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "delivery" JSONB NOT NULL DEFAULT '{}',
    "dedupe_key" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_rules" (
    "id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "recipients" TEXT[],
    "timing" JSONB NOT NULL DEFAULT '{}',
    "channels" "public"."NotificationChannel"[],
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" UUID,
    "ip" TEXT,
    "user_agent" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "action" "public"."AuditAction" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."code_sequences" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "code_sequences_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_line_user_id_key" ON "public"."users"("line_user_id");

-- CreateIndex
CREATE INDEX "users_team_id_idx" ON "public"."users"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key" ON "public"."teams"("name");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "public"."roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "public"."permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "owners_code_key" ON "public"."owners"("code");

-- CreateIndex
CREATE INDEX "owners_phone_idx" ON "public"."owners"("phone");

-- CreateIndex
CREATE INDEX "owners_line_id_idx" ON "public"."owners"("line_id");

-- CreateIndex
CREATE INDEX "owners_email_idx" ON "public"."owners"("email");

-- CreateIndex
CREATE INDEX "owners_agent_id_idx" ON "public"."owners"("agent_id");

-- CreateIndex
CREATE INDEX "owners_full_name_trgm_idx" ON "public"."owners" USING GIN ("full_name" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "projects_name_key" ON "public"."projects"("name");

-- CreateIndex
CREATE INDEX "projects_name_trgm_idx" ON "public"."projects" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "assets_code_key" ON "public"."assets"("code");

-- CreateIndex
CREATE INDEX "assets_category_status_idx" ON "public"."assets"("category", "status");

-- CreateIndex
CREATE INDEX "assets_ownership_type_idx" ON "public"."assets"("ownership_type");

-- CreateIndex
CREATE INDEX "assets_owner_id_idx" ON "public"."assets"("owner_id");

-- CreateIndex
CREATE INDEX "assets_project_id_idx" ON "public"."assets"("project_id");

-- CreateIndex
CREATE INDEX "assets_building_id_idx" ON "public"."assets"("building_id");

-- CreateIndex
CREATE INDEX "assets_primary_agent_id_idx" ON "public"."assets"("primary_agent_id");

-- CreateIndex
CREATE INDEX "assets_unit_no_trgm_idx" ON "public"."assets" USING GIN ("unit_no" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "asset_agents_user_id_idx" ON "public"."asset_agents"("user_id");

-- CreateIndex
CREATE INDEX "asset_media_asset_id_sort_order_idx" ON "public"."asset_media"("asset_id", "sort_order");

-- CreateIndex
CREATE INDEX "listing_agreements_asset_id_status_idx" ON "public"."listing_agreements"("asset_id", "status");

-- CreateIndex
CREATE INDEX "listing_agreements_end_date_idx" ON "public"."listing_agreements"("end_date");

-- CreateIndex
CREATE UNIQUE INDEX "listings_slug_key" ON "public"."listings"("slug");

-- CreateIndex
CREATE INDEX "listings_status_type_idx" ON "public"."listings"("status", "type");

-- CreateIndex
CREATE INDEX "listings_asset_id_idx" ON "public"."listings"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_code_key" ON "public"."leads"("code");

-- CreateIndex
CREATE INDEX "leads_phone_idx" ON "public"."leads"("phone");

-- CreateIndex
CREATE INDEX "leads_line_id_idx" ON "public"."leads"("line_id");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "public"."leads"("email");

-- CreateIndex
CREATE INDEX "leads_owner_agent_id_status_idx" ON "public"."leads"("owner_agent_id", "status");

-- CreateIndex
CREATE INDEX "leads_next_follow_up_at_idx" ON "public"."leads"("next_follow_up_at");

-- CreateIndex
CREATE INDEX "leads_full_name_trgm_idx" ON "public"."leads" USING GIN ("full_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "leads_phone_trgm_idx" ON "public"."leads" USING GIN ("phone" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "lead_assignments_lead_id_created_at_idx" ON "public"."lead_assignments"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "lead_collaborators_user_id_idx" ON "public"."lead_collaborators"("user_id");

-- CreateIndex
CREATE INDEX "activities_lead_id_created_at_idx" ON "public"."activities"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "activities_owner_id_created_at_idx" ON "public"."activities"("owner_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "lead_offers_share_token_key" ON "public"."lead_offers"("share_token");

-- CreateIndex
CREATE UNIQUE INDEX "lead_offers_lead_id_asset_id_key" ON "public"."lead_offers"("lead_id", "asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_code_key" ON "public"."appointments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_rescheduled_from_id_key" ON "public"."appointments"("rescheduled_from_id");

-- CreateIndex
CREATE INDEX "appointments_agent_id_starts_at_idx" ON "public"."appointments"("agent_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_lead_id_idx" ON "public"."appointments"("lead_id");

-- CreateIndex
CREATE INDEX "appointments_starts_at_idx" ON "public"."appointments"("starts_at");

-- CreateIndex
CREATE INDEX "appointment_items_asset_id_idx" ON "public"."appointment_items"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_code_key" ON "public"."bookings"("code");

-- CreateIndex
CREATE INDEX "bookings_asset_id_status_idx" ON "public"."bookings"("asset_id", "status");

-- CreateIndex
CREATE INDEX "bookings_lead_id_idx" ON "public"."bookings"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contract_no_key" ON "public"."contracts"("contract_no");

-- CreateIndex
CREATE INDEX "contracts_asset_id_status_idx" ON "public"."contracts"("asset_id", "status");

-- CreateIndex
CREATE INDEX "contracts_lead_id_idx" ON "public"."contracts"("lead_id");

-- CreateIndex
CREATE INDEX "contracts_end_date_idx" ON "public"."contracts"("end_date");

-- CreateIndex
CREATE INDEX "contract_parties_contract_id_idx" ON "public"."contract_parties"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "sale_deals_code_key" ON "public"."sale_deals"("code");

-- CreateIndex
CREATE INDEX "sale_deals_asset_id_stage_idx" ON "public"."sale_deals"("asset_id", "stage");

-- CreateIndex
CREATE INDEX "sale_deals_agent_id_stage_idx" ON "public"."sale_deals"("agent_id", "stage");

-- CreateIndex
CREATE INDEX "payments_asset_id_paid_at_idx" ON "public"."payments"("asset_id", "paid_at");

-- CreateIndex
CREATE INDEX "payments_type_paid_at_idx" ON "public"."payments"("type", "paid_at");

-- CreateIndex
CREATE INDEX "payments_contract_id_idx" ON "public"."payments"("contract_id");

-- CreateIndex
CREATE INDEX "rent_schedules_due_date_status_idx" ON "public"."rent_schedules"("due_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rent_schedules_contract_id_period_start_key" ON "public"."rent_schedules"("contract_id", "period_start");

-- CreateIndex
CREATE INDEX "expenses_asset_id_incurred_at_idx" ON "public"."expenses"("asset_id", "incurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_contract_id_key" ON "public"."commissions"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_sale_deal_id_key" ON "public"."commissions"("sale_deal_id");

-- CreateIndex
CREATE INDEX "commissions_status_idx" ON "public"."commissions"("status");

-- CreateIndex
CREATE INDEX "commissions_asset_id_idx" ON "public"."commissions"("asset_id");

-- CreateIndex
CREATE INDEX "commission_splits_commission_id_revision_idx" ON "public"."commission_splits"("commission_id", "revision");

-- CreateIndex
CREATE INDEX "commission_splits_user_id_idx" ON "public"."commission_splits"("user_id");

-- CreateIndex
CREATE INDEX "commission_splits_payout_id_idx" ON "public"."commission_splits"("payout_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_revisions_commission_id_revision_key" ON "public"."commission_revisions"("commission_id", "revision");

-- CreateIndex
CREATE INDEX "commission_payouts_user_id_status_idx" ON "public"."commission_payouts"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "public"."files"("storage_key");

-- CreateIndex
CREATE INDEX "files_entity_type_entity_id_idx" ON "public"."files"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "public"."notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "public"."notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_rules_event_key" ON "public"."notification_rules"("event");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "public"."audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "public"."audit_logs"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teams" ADD CONSTRAINT "teams_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."owners" ADD CONSTRAINT "owners_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."buildings" ADD CONSTRAINT "buildings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."buildings" ADD CONSTRAINT "buildings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assets" ADD CONSTRAINT "assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assets" ADD CONSTRAINT "assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assets" ADD CONSTRAINT "assets_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assets" ADD CONSTRAINT "assets_primary_agent_id_fkey" FOREIGN KEY ("primary_agent_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asset_agents" ADD CONSTRAINT "asset_agents_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asset_agents" ADD CONSTRAINT "asset_agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asset_media" ADD CONSTRAINT "asset_media_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asset_media" ADD CONSTRAINT "asset_media_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."listing_agreements" ADD CONSTRAINT "listing_agreements_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."listing_agreements" ADD CONSTRAINT "listing_agreements_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."listing_agreements" ADD CONSTRAINT "listing_agreements_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."listings" ADD CONSTRAINT "listings_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."listings" ADD CONSTRAINT "listings_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_preferred_project_id_fkey" FOREIGN KEY ("preferred_project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_source_listing_id_fkey" FOREIGN KEY ("source_listing_id") REFERENCES "public"."listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_owner_agent_id_fkey" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_assignments" ADD CONSTRAINT "lead_assignments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_assignments" ADD CONSTRAINT "lead_assignments_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_assignments" ADD CONSTRAINT "lead_assignments_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_assignments" ADD CONSTRAINT "lead_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_collaborators" ADD CONSTRAINT "lead_collaborators_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_collaborators" ADD CONSTRAINT "lead_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_offers" ADD CONSTRAINT "lead_offers_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_offers" ADD CONSTRAINT "lead_offers_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_offers" ADD CONSTRAINT "lead_offers_offered_by_id_fkey" FOREIGN KEY ("offered_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointment_items" ADD CONSTRAINT "appointment_items_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointment_items" ADD CONSTRAINT "appointment_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_revision_of_id_fkey" FOREIGN KEY ("revision_of_id") REFERENCES "public"."contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_previous_contract_id_fkey" FOREIGN KEY ("previous_contract_id") REFERENCES "public"."contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contract_parties" ADD CONSTRAINT "contract_parties_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sale_deals" ADD CONSTRAINT "sale_deals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sale_deals" ADD CONSTRAINT "sale_deals_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sale_deals" ADD CONSTRAINT "sale_deals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sale_deals" ADD CONSTRAINT "sale_deals_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_sale_deal_id_fkey" FOREIGN KEY ("sale_deal_id") REFERENCES "public"."sale_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_rent_schedule_id_fkey" FOREIGN KEY ("rent_schedule_id") REFERENCES "public"."rent_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_proof_file_id_fkey" FOREIGN KEY ("proof_file_id") REFERENCES "public"."files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rent_schedules" ADD CONSTRAINT "rent_schedules_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_proof_file_id_fkey" FOREIGN KEY ("proof_file_id") REFERENCES "public"."files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commissions" ADD CONSTRAINT "commissions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commissions" ADD CONSTRAINT "commissions_sale_deal_id_fkey" FOREIGN KEY ("sale_deal_id") REFERENCES "public"."sale_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commissions" ADD CONSTRAINT "commissions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commissions" ADD CONSTRAINT "commissions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_splits" ADD CONSTRAINT "commission_splits_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_splits" ADD CONSTRAINT "commission_splits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_splits" ADD CONSTRAINT "commission_splits_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "public"."commission_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_revisions" ADD CONSTRAINT "commission_revisions_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_revisions" ADD CONSTRAINT "commission_revisions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_payouts" ADD CONSTRAINT "commission_payouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_payouts" ADD CONSTRAINT "commission_payouts_proof_file_id_fkey" FOREIGN KEY ("proof_file_id") REFERENCES "public"."files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
