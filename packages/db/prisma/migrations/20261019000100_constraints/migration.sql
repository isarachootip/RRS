-- =====================================================================
-- 0002 constraints: กฎที่ Prisma schema เขียนไม่ได้ (EXCLUDE, CHECK, trigger)
-- Prisma migrate ไม่ลบ CHECK/EXCLUDE constraint และ trigger เหล่านี้
-- อ้างอิง: CLAUDE.md กฎข้อ 5–6, docs/design.md ข้อ 3, 6
-- =====================================================================

-- ---------- กันจองซ้ำ (SRS 3.4) ----------
-- ช่วงวันที่ [start_date, end_date] รวมวันสุดท้าย: ผู้เช่าเดิมออก 31 ผู้เช่าใหม่เข้า 1 ได้ แต่วันเดียวกันไม่ได้
-- booking ล็อกห้องเมื่อชำระแล้ว (PAID); เมื่อแปลงเป็นสัญญา (CONVERTED) สัญญารับช่วงการล็อกแทน
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("asset_id" WITH =, daterange("start_date", "end_date", '[]') WITH &&)
  WHERE ("status" = 'PAID');

-- สัญญาที่รอลงนาม/มีผล ล็อกห้องจนถึงวันหมดสัญญา หรือวันยกเลิกก่อนกำหนด
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_no_overlap"
  EXCLUDE USING gist ("asset_id" WITH =, daterange("start_date", COALESCE("terminated_at", "end_date"), '[]') WITH &&)
  WHERE ("status" IN ('PENDING_SIGNATURE', 'ACTIVE'));

-- ตรวจข้ามตาราง booking ↔ contract (EXCLUDE ทำข้ามตารางไม่ได้)
-- ใช้ advisory lock ต่อห้อง กัน race condition เมื่อมีคนบันทึกพร้อมกัน
CREATE FUNCTION "assert_asset_period_free"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  conflict text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."asset_id"::text, 0));

  IF TG_TABLE_NAME = 'bookings' THEN
    IF NEW."status" <> 'PAID' THEN
      RETURN NEW;
    END IF;
    SELECT c."contract_no" INTO conflict
      FROM "contracts" c
     WHERE c."asset_id" = NEW."asset_id"
       AND c."status" IN ('PENDING_SIGNATURE', 'ACTIVE')
       AND c."booking_id" IS DISTINCT FROM NEW."id"
       AND daterange(c."start_date", COALESCE(c."terminated_at", c."end_date"), '[]')
           && daterange(NEW."start_date", NEW."end_date", '[]')
     LIMIT 1;
  ELSE
    IF NEW."status" NOT IN ('PENDING_SIGNATURE', 'ACTIVE') THEN
      RETURN NEW;
    END IF;
    SELECT b."code" INTO conflict
      FROM "bookings" b
     WHERE b."asset_id" = NEW."asset_id"
       AND b."status" = 'PAID'
       AND b."id" IS DISTINCT FROM NEW."booking_id"
       AND daterange(b."start_date", b."end_date", '[]')
           && daterange(NEW."start_date", COALESCE(NEW."terminated_at", NEW."end_date"), '[]')
     LIMIT 1;
  END IF;

  IF conflict IS NOT NULL THEN
    RAISE EXCEPTION 'asset_period_overlap: asset % is already reserved by %', NEW."asset_id", conflict
      USING ERRCODE = '23P01', CONSTRAINT = 'asset_period_overlap';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "bookings_period_free"
  BEFORE INSERT OR UPDATE OF "status", "asset_id", "start_date", "end_date" ON "bookings"
  FOR EACH ROW EXECUTE FUNCTION "assert_asset_period_free"();

CREATE TRIGGER "contracts_period_free"
  BEFORE INSERT OR UPDATE OF "status", "asset_id", "start_date", "end_date", "terminated_at" ON "contracts"
  FOR EACH ROW EXECUTE FUNCTION "assert_asset_period_free"();

-- ---------- สัญญาที่มีผลแล้วห้ามแก้เนื้อหา (SRS 3.6, CLAUDE.md กฎข้อ 5) ----------
-- แก้ไข = สร้างแถวใหม่ revision+1 และเปลี่ยนแถวเดิมเป็น SUPERSEDED
-- อนุญาตเฉพาะ status, signed_at, terminated_at, termination_reason, reminder_days, note, file_id, updated_*
CREATE FUNCTION "contracts_guard_locked"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" IN ('ACTIVE', 'ENDED', 'TERMINATED', 'SUPERSEDED') AND (
       NEW."contract_no", NEW."revision", NEW."revision_of_id", NEW."previous_contract_id", NEW."booking_id",
       NEW."asset_id", NEW."lead_id", NEW."owner_id", NEW."monthly_rent", NEW."security_deposit",
       NEW."advance_rent", NEW."start_date", NEW."end_date", NEW."commission_formula", NEW."commission_params"
     ) IS DISTINCT FROM (
       OLD."contract_no", OLD."revision", OLD."revision_of_id", OLD."previous_contract_id", OLD."booking_id",
       OLD."asset_id", OLD."lead_id", OLD."owner_id", OLD."monthly_rent", OLD."security_deposit",
       OLD."advance_rent", OLD."start_date", OLD."end_date", OLD."commission_formula", OLD."commission_params"
     ) THEN
    RAISE EXCEPTION 'contract_locked: contract % is %, create a new revision instead', OLD."contract_no", OLD."status"
      USING ERRCODE = '55000';
  END IF;
  IF OLD."status" IN ('ENDED', 'TERMINATED', 'SUPERSEDED') AND NEW."status" <> OLD."status" THEN
    RAISE EXCEPTION 'contract_locked: contract % is closed (%)', OLD."contract_no", OLD."status"
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "contracts_locked"
  BEFORE UPDATE ON "contracts"
  FOR EACH ROW EXECUTE FUNCTION "contracts_guard_locked"();

-- ---------- audit_logs append-only (SRS 2.4, 7) ----------
CREATE FUNCTION "append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append_only: % on % is not allowed', TG_OP, TG_TABLE_NAME
    USING ERRCODE = '42501';
END
$$;

CREATE TRIGGER "audit_logs_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "append_only"();

CREATE TRIGGER "audit_logs_no_truncate"
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "append_only"();

-- snapshot ค่านายหน้าแก้ไม่ได้ ยกเว้นการบันทึกผู้อนุมัติครั้งแรก
CREATE FUNCTION "commission_revisions_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'append_only: DELETE on commission_revisions is not allowed' USING ERRCODE = '42501';
  END IF;
  IF (NEW."commission_id", NEW."revision", NEW."snapshot", NEW."reason", NEW."created_by_id", NEW."created_at")
     IS DISTINCT FROM
     (OLD."commission_id", OLD."revision", OLD."snapshot", OLD."reason", OLD."created_by_id", OLD."created_at")
     OR OLD."approved_at" IS NOT NULL THEN
    RAISE EXCEPTION 'append_only: commission revision % is immutable', OLD."revision" USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "commission_revisions_immutable"
  BEFORE UPDATE OR DELETE ON "commission_revisions"
  FOR EACH ROW EXECUTE FUNCTION "commission_revisions_guard"();

-- ---------- CHECK constraints ----------
ALTER TABLE "owners" ADD CONSTRAINT "owners_single_company"
  EXCLUDE USING btree ("is_company" WITH =) WHERE ("is_company");

ALTER TABLE "assets"
  ADD CONSTRAINT "assets_prices_non_negative" CHECK (
    COALESCE("rent_price", 0) >= 0 AND COALESCE("min_rent_price", 0) >= 0 AND
    COALESCE("sale_price", 0) >= 0 AND COALESCE("min_sale_price", 0) >= 0),
  ADD CONSTRAINT "assets_area_positive" CHECK ("area_sqm" IS NULL OR "area_sqm" > 0),
  ADD CONSTRAINT "assets_attributes_object" CHECK (jsonb_typeof("attributes") = 'object');

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_budget_range" CHECK ("budget_min" IS NULL OR "budget_max" IS NULL OR "budget_max" >= "budget_min");

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_time_range" CHECK ("ends_at" > "starts_at");

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_date_range" CHECK ("end_date" >= "start_date"),
  ADD CONSTRAINT "bookings_amounts_non_negative" CHECK (
    "monthly_rent" >= 0 AND "booking_fee" >= 0 AND "security_deposit" >= 0 AND "advance_rent" >= 0);

ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_date_range" CHECK ("end_date" >= "start_date"),
  ADD CONSTRAINT "contracts_termination_in_range" CHECK (
    "terminated_at" IS NULL OR "terminated_at" BETWEEN "start_date" AND "end_date"),
  ADD CONSTRAINT "contracts_amounts_non_negative" CHECK (
    "monthly_rent" >= 0 AND "security_deposit" >= 0 AND "advance_rent" >= 0),
  ADD CONSTRAINT "contracts_revision_positive" CHECK ("revision" >= 1);

ALTER TABLE "sale_deals"
  ADD CONSTRAINT "sale_deals_prices_non_negative" CHECK (
    COALESCE("asking_price", 0) >= 0 AND COALESCE("offered_price", 0) >= 0 AND
    COALESCE("agreed_price", 0) >= 0 AND COALESCE("deposit_amount", 0) >= 0);

ALTER TABLE "listings"
  ADD CONSTRAINT "listings_price_non_negative" CHECK ("price" >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "rent_schedules"
  ADD CONSTRAINT "rent_schedules_period" CHECK ("period_end" >= "period_start"),
  ADD CONSTRAINT "rent_schedules_amounts" CHECK ("amount_due" >= 0 AND "amount_paid" >= 0);

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amount_positive" CHECK ("amount" > 0);

-- ค่านายหน้า 1 รายการต้องผูกกับสัญญาเช่าหรือดีลขาย อย่างใดอย่างหนึ่งพอดี
ALTER TABLE "commissions"
  ADD CONSTRAINT "commissions_single_source" CHECK (num_nonnulls("contract_id", "sale_deal_id") = 1),
  ADD CONSTRAINT "commissions_amounts_non_negative" CHECK ("base_amount" >= 0 AND "total_amount" >= 0),
  ADD CONSTRAINT "commissions_revision_positive" CHECK ("current_revision" >= 1);

-- ส่วนแบ่ง: % อยู่ใน 0–100 และมีเฉพาะแบบ PERCENT; แถวบริษัทไม่มี user_id ส่วนบทบาทอื่นต้องมี
-- (ผลรวม 100% / ไม่เกินยอดรวม ตรวจใน Commission engine ก่อนบันทึก — P14)
ALTER TABLE "commission_splits"
  ADD CONSTRAINT "commission_splits_percent_range" CHECK (
    ("share_type" = 'PERCENT' AND "share_percent" IS NOT NULL AND "share_percent" BETWEEN 0 AND 100)
    OR ("share_type" = 'AMOUNT' AND "share_percent" IS NULL)),
  ADD CONSTRAINT "commission_splits_company_user" CHECK (("role" = 'COMPANY') = ("user_id" IS NULL)),
  ADD CONSTRAINT "commission_splits_amounts" CHECK (
    "amount" >= 0 AND "withholding_tax" >= 0 AND "net_amount" = "amount" - "withholding_tax");

ALTER TABLE "commission_payouts"
  ADD CONSTRAINT "commission_payouts_amount" CHECK ("total_amount" >= 0);
