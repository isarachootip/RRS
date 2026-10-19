# ERD — โครงสร้างฐานข้อมูล

แหล่งจริงคือ `packages/db/prisma/schema.prisma` และ constraint ที่ Prisma เขียนไม่ได้อยู่ใน `packages/db/prisma/migrations/20261019000100_constraints/migration.sql`
แผนภาพนี้แสดงเฉพาะตารางและความสัมพันธ์หลัก (ไม่รวมคอลัมน์ audit: created_by_id, updated_by_id, archived_at, archived_by_id)

## 1. ผู้ใช้และสิทธิ์

```mermaid
erDiagram
  users ||--o{ user_roles : has
  roles ||--o{ user_roles : grants
  roles ||--o{ role_permissions : has
  permissions ||--o{ role_permissions : in
  teams ||--o{ users : members
  users ||--o{ teams : manages

  users { uuid id PK
    string email UK
    string full_name
    uuid team_id FK
    bool is_freelance
    bool totp_enabled }
  roles { uuid id PK
    string code UK "ADMIN MANAGER AGENT ACCOUNTING"
    bool is_system }
  permissions { uuid id PK
    string code UK "เช่น lead.read" }
  role_permissions { uuid role_id PK
    uuid permission_id PK
    enum scope "ALL TEAM OWN" }
  teams { uuid id PK
    string name UK
    uuid manager_id FK }
```

## 2. เจ้าของ ทรัพย์สิน ประกาศ

```mermaid
erDiagram
  owners ||--o{ assets : owns
  owners ||--o{ buildings : owns
  projects ||--o{ assets : in
  projects ||--o{ buildings : in
  buildings ||--o{ assets : units
  assets ||--o{ asset_agents : "agents"
  users ||--o{ asset_agents : works
  assets ||--o{ asset_media : photos
  files ||--o{ asset_media : file
  assets ||--o{ listing_agreements : "ฝากเช่า/ฝากขาย"
  owners ||--o{ listing_agreements : signs
  assets ||--o{ listings : "ประกาศ Portal"

  owners { uuid id PK
    string code UK "OW-000001"
    bool is_company "บริษัท 1 รายการ"
    string phone "E.164"
    enum status
    uuid agent_id FK }
  assets { uuid id PK
    string code UK "PR-000001"
    enum category "CONDO HOUSE FACTORY ..."
    enum ownership_type "OWNER AGENT"
    uuid owner_id FK
    jsonb attributes "ตามประเภท"
    decimal rent_price
    decimal min_rent_price "ลับ"
    decimal sale_price
    enum status }
  listing_agreements { uuid id PK
    enum transaction_type "RENT SALE"
    date end_date
    enum commission_formula
    jsonb commission_params }
  listings { uuid id PK
    enum type "RENT SALE"
    enum status "DRAFT ... PUBLISHED"
    string slug UK
    decimal price }
```

## 3. CRM และนัดหมาย

```mermaid
erDiagram
  users ||--o{ leads : "owner agent"
  leads ||--o{ lead_assignments : "ประวัติโอน"
  leads ||--o{ lead_collaborators : "ผู้ร่วมงาน"
  leads ||--o{ activities : "โทร แชต โน้ต"
  leads ||--o{ lead_offers : "ห้องที่เสนอ"
  assets ||--o{ lead_offers : offered
  leads ||--o{ appointments : books
  appointments ||--o{ appointment_items : "หลายห้อง"
  assets ||--o{ appointment_items : viewed
  appointments |o--o| appointments : "rescheduled_from"
  listings ||--o{ leads : "แหล่งที่มา"

  leads { uuid id PK
    string code UK "LD-000001"
    enum intent "RENT BUY"
    string phone "E.164 ตรวจซ้ำ"
    uuid owner_agent_id FK
    enum status
    timestamptz next_follow_up_at }
  lead_assignments { uuid id PK
    uuid from_user_id
    uuid to_user_id
    uuid assigned_by_id
    string reason }
  appointments { uuid id PK
    timestamptz starts_at
    timestamptz ends_at
    uuid agent_id FK "ตรวจนัดซ้อน"
    enum status }
  appointment_items { uuid appointment_id PK
    uuid asset_id PK
    enum outcome "ผลติดตาม" }
```

## 4. จอง สัญญา ขาย

```mermaid
erDiagram
  leads ||--o{ bookings : books
  assets ||--o{ bookings : booked
  bookings ||--o{ contracts : "แปลงเป็น"
  assets ||--o{ contracts : leased
  owners ||--o{ contracts : lessor
  contracts ||--o{ contracts : "revision_of / previous (ต่อสัญญา)"
  contracts ||--o{ contract_parties : parties
  leads ||--o{ sale_deals : buys
  assets ||--o{ sale_deals : sold

  bookings { uuid id PK
    string code UK "BK-000001"
    date start_date
    date end_date
    enum status "PAID ล็อกห้อง" }
  contracts { uuid id PK
    string contract_no UK
    int revision
    decimal monthly_rent
    date start_date
    date end_date
    date terminated_at
    enum status "ACTIVE ล็อกห้อง/ห้ามแก้" }
  sale_deals { uuid id PK
    enum stage
    decimal agreed_price
    date transfer_date }
```

## 5. การเงินและค่านายหน้า

```mermaid
erDiagram
  contracts ||--o{ rent_schedules : "งวดค่าเช่า"
  rent_schedules ||--o{ payments : paid
  contracts ||--o{ payments : ""
  bookings ||--o{ payments : ""
  sale_deals ||--o{ payments : ""
  assets ||--o{ expenses : costs
  contracts |o--o| commissions : ""
  sale_deals |o--o| commissions : ""
  commissions ||--o{ commission_splits : "ส่วนแบ่งต่อ revision"
  commissions ||--o{ commission_revisions : "snapshot"
  users ||--o{ commission_splits : receives
  commission_payouts ||--o{ commission_splits : "รอบจ่าย"
  commissions ||--o{ payments : "รับจากเจ้าของ"

  payments { uuid id PK
    enum type
    enum direction "IN OUT"
    decimal amount
    timestamptz paid_at
    uuid proof_file_id }
  commissions { uuid id PK
    uuid contract_id UK "หรือ"
    uuid sale_deal_id UK "อย่างใดอย่างหนึ่ง"
    enum formula
    decimal base_amount
    decimal total_amount
    enum status
    int current_revision }
  commission_splits { uuid id PK
    int revision
    enum role "FINDER LISTING SHOWING CLOSER COMPANY"
    uuid user_id "null = บริษัท"
    decimal share_percent
    decimal amount
    decimal net_amount }
```

## 6. ระบบ

`files` (ไฟล์ทุกชนิด, polymorphic entity_type/entity_id), `notifications`, `notification_rules`, `audit_logs` (append-only), `code_sequences` (เลขรัน)

## Constraint สำคัญในฐานข้อมูล

| ชื่อ | ตาราง | กฎ |
| --- | --- | --- |
| `bookings_no_overlap` | bookings | จองที่ PAID ห้ามช่วงวันที่ทับกันบนห้องเดียวกัน (EXCLUDE gist) |
| `contracts_no_overlap` | contracts | สัญญา PENDING_SIGNATURE/ACTIVE ห้ามทับกัน คิดถึงวันยกเลิกก่อนกำหนด |
| `asset_period_overlap` | bookings, contracts | trigger ตรวจข้ามตาราง จอง ↔ สัญญา พร้อม advisory lock ต่อห้อง |
| `contract_locked` | contracts | สัญญาที่มีผล/ปิดแล้ว ห้ามแก้เนื้อหา ต้องสร้าง revision ใหม่ |
| `append_only` | audit_logs, commission_revisions | ห้าม UPDATE/DELETE/TRUNCATE |
| `owners_single_company` | owners | มีเจ้าของประเภทบริษัทได้รายการเดียว |
| `commissions_single_source` | commissions | ผูกสัญญาหรือดีลขายอย่างใดอย่างหนึ่งพอดี |
| `commission_splits_*` | commission_splits | % 0–100, แถวบริษัทไม่มี user, net = amount − ภาษี |
| CHECK อื่น ๆ | หลายตาราง | ยอดเงินไม่ติดลบ, วันสิ้นสุด ≥ วันเริ่ม, attributes เป็น object |
