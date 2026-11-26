# ULTIMATE — Architecture & Technical Guide (`ultimate-wear.com`)

> Complete technical overview, architecture & database Mermaid diagrams, security layers, and operational tips.

---

## 1. Summary of Implemented Features & Fixes

### A. Smart Single-Step Registration (Name + Phone + Email Once)
- **Single-Form Sign-Up**: [src/components/layout/AuthModal.tsx](src/components/layout/AuthModal.tsx) collects **Full Name + Egyptian WhatsApp/Mobile (`01XXXXXXXXX`) + Email + Password** in one step.
- **No Re-Prompting**:
  - [src/app/api/auth/register/route.ts](src/app/api/auth/register/route.ts) validates `registerSchema` ([src/lib/security/validation.ts](src/lib/security/validation.ts)) and stores `full_name` and `phone` in Supabase Auth `user_metadata` immediately.
  - [supabase/schema.sql](supabase/schema.sql) updates `handle_new_user()` (`SECURITY DEFINER`) to copy `raw_user_meta_data->>'full_name'` and `raw_user_meta_data->>'phone'` into `public.profiles`.
  - [src/components/auth/VerifyEmailClient.tsx](src/components/auth/VerifyEmailClient.tsx) carries the pending profile metadata to [src/app/api/auth/verify/route.ts](src/app/api/auth/verify/route.ts), which saves the profile during OTP verification.
  - [src/components/providers/AuthProvider.tsx](src/components/providers/AuthProvider.tsx) merges DB profile rows with `user_metadata` fallback, silently backfills missing DB fields once in the background via [src/app/api/profile/phone/route.ts](src/app/api/profile/phone/route.ts), and never interrupts browsing with unsolicited profile prompts.
  - [src/lib/supabase/service.ts](src/lib/supabase/service.ts) provides `createOptionalServiceClient()` so server routes never crash when `SUPABASE_SERVICE_ROLE_KEY` is omitted from `.env.local`.

### B. Hidden Admin Portal (`/studio-vault`) & Concealed `/admin`
- Legacy `/admin` ([src/app/admin/layout.tsx](src/app/admin/layout.tsx), [src/app/admin/page.tsx](src/app/admin/page.tsx)) always invokes `notFound()` (**HTTP 404**).
- Active admin portal lives at `ADMIN_PORTAL_PATH` (`/studio-vault` in [src/lib/constants.ts](src/lib/constants.ts)).
- [src/app/studio-vault/layout.tsx](src/app/studio-vault/layout.tsx) calls `checkIsAdminUser()` and returns `notFound()` (**404**) for unauthenticated or non-admin users.
- All `/api/admin/*` endpoints use `requireAdminApi()` ([src/lib/security/admin-auth.ts](src/lib/security/admin-auth.ts)) and rate limiting in [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts).

### C. Responsive 4-Corner Orbital Hero & Multi-Font Typography
- [src/components/storefront/FlyingHoodiesHero.tsx](src/components/storefront/FlyingHoodiesHero.tsx) displays all 4 featured hoodies around the central zero-gravity model on mobile, tablet, and desktop.
- [src/app/layout.tsx](src/app/layout.tsx) loads 7 Google Fonts (`Syne`, `Cairo`, `Cormorant Garamond`, `Amiri`, `Plus Jakarta Sans`, `IBM Plex Sans Arabic`, `JetBrains Mono`).

### D. Multi-Color Product Skins & Dynamic Sections CMS
- [src/components/admin/ProductEditorModal.tsx](src/components/admin/ProductEditorModal.tsx) manages per-hoodie `ProductColorVariant` skins (EN/AR names, hex color, custom image URL).
- [src/components/admin/SectionsManagerTab.tsx](src/components/admin/SectionsManagerTab.tsx) lets admins add/remove/reorder `StoreSection` entries and edit storefront EN/AR copy (`StoreSettings`), persisted via [src/lib/store-config.ts](src/lib/store-config.ts) to Supabase with local `data/store-config.json` fallback.

---

## 2. Complete System Diagrams

### System Architecture

```mermaid
flowchart TB
    User["Customer & Admin Browser (RTL AR / LTR EN)"] --> MW["Next.js Middleware (Rate Limit + Session Refresh)"]

    subgraph Frontend["Next.js App Router (Frontend & SSR)"]
        Home["/ (Storefront Home Page)"]
        Hero["FlyingHoodiesHero (4-Corner Orbit + Dynamic Copy)"]
        Shop["ShopSection & ProductCard (Multi-Color Skins)"]
        Checkout["/checkout (Vodafone Cash / InstaPay + Receipt)"]
        Orders["/orders (Customer Order Tracking)"]
        Verify["/verify-email (6-Digit CodeSlots OTP)"]
        OldAdmin["/admin (Returns 404 Not Found)"]
        Vault["/studio-vault (Hidden Admin Portal -> 404 for Non-Admins)"]
    end

    MW --> Frontend

    subgraph API["Next.js Route Handlers (Zod Validation + Rate Limits)"]
        AuthAPI["/api/auth/* (register, login, otp, verify)"]
        ProfileAPI["/api/profile/phone (Metadata + Profile Sync)"]
        CatalogAPI["/api/products & /api/sections"]
        OrderAPI["/api/orders, /receipt, /notify"]
        AdminAPI["/api/admin/* (products, sections, orders)"]
    end

    Frontend --> API

    subgraph Backend["Supabase + Local Config + Notifications"]
        SupaAuth["Supabase Auth (Email/Password + 6-Digit OTP + Metadata)"]
        SupaDB["PostgreSQL + RLS (profiles, products, store_sections, store_settings, orders, order_items)"]
        SupaStorage["Supabase Storage (product-images, payment-receipts)"]
        LocalCfg["data/store-config.json (Fallback & Overrides)"]
        Telegram["Telegram Bot API (Order Photo + Details)"]
    end

    AuthAPI --> SupaAuth
    ProfileAPI --> SupaAuth
    ProfileAPI --> SupaDB
    CatalogAPI --> SupaDB
    CatalogAPI --> LocalCfg
    OrderAPI --> SupaDB
    OrderAPI --> SupaStorage
    OrderAPI --> Telegram
    AdminAPI --> SupaDB
    AdminAPI --> LocalCfg
    AdminAPI --> SupaStorage
```

### Single-Step Registration & OTP Verification Flow

```mermaid
sequenceDiagram
    actor U as User
    participant M as AuthModal (Register Tab)
    participant R as POST /api/auth/register
    participant SA as Supabase Auth & Trigger
    participant V as /verify-email -> /api/auth/verify
    participant AP as AuthProvider

    U->>M: Enters Full Name + Phone (01XXXXXXXXX) + Email + Password
    M->>M: Validates Name & EGYPT_MOBILE_REGEX
    M->>M: Saves pending profile in sessionStorage
    M->>R: POST { email, password, fullName, phone }
    R->>SA: signUp(email, password, data: { full_name, phone })
    SA-->>SA: Trigger handle_new_user inserts profiles(id, email, full_name, phone)
    R-->>M: 201 { registered: true, requiresVerification: true }
    M->>V: Redirects to /verify-email?email=...
    U->>V: Enters 6-digit OTP code
    V->>SA: verifyOtp(email, token)
    V->>SA: Upserts profiles with full_name + phone
    V-->>U: Redirects straight to / or /studio-vault
    AP->>SA: Hydrates profile (DB row + user_metadata fallback)
```

### Checkout, Receipt Validation & Order Creation

```mermaid
flowchart LR
    Cart["CartDrawer (Item + Size + Color Skin)"] --> Check{"Authenticated & Email Verified & Phone Exists?"}
    Check -- No --> Auth["AuthModal (Sign In / Register)"]
    Check -- Yes --> Upload["1. Upload Screenshot -> POST /api/orders/receipt"]
    Upload --> MagicBytes["Magic-Bytes Check (JPG/PNG/WEBP <= 5MB)"]
    MagicBytes --> Bucket["Private Bucket: payment-receipts/{userId}/{uuid}.ext"]
    Bucket --> Submit["2. Hold to Order -> POST /api/orders"]
    Submit --> ServerCalc["Server Re-computes Prices from PostgreSQL"]
    ServerCalc --> InsertOrder["Insert orders + order_items (pending_verification)"]
    InsertOrder --> TG["3. POST /api/orders/notify -> Telegram Bot Photo Alert"]
```

### Database Schema ERD

```mermaid
erDiagram
    PROFILES {
        uuid id PK
        text email
        text full_name
        text phone
        boolean is_admin
        timestamptz created_at
        timestamptz updated_at
    }
    PRODUCTS {
        uuid id PK
        text slug UK
        text title_en
        text title_ar
        text category
        integer price_egp
        integer compare_at_price_egp
        text[] sizes
        text image_url
        jsonb colors
        boolean is_featured
        boolean in_stock
    }
    ORDERS {
        uuid id PK
        text order_code UK
        uuid user_id FK
        text customer_email
        text customer_phone
        text shipping_address
        text city
        text payment_method
        text receipt_path
        integer total_amount
        text status
        boolean telegram_notified
    }
    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        text product_title_en
        text product_title_ar
        text size
        text color_name
        integer quantity
        integer unit_price
    }
    STORE_SECTIONS {
        text slug PK
        text label_en
        text label_ar
        integer sort_order
        boolean is_active
        boolean show_in_hero
    }
    STORE_SETTINGS {
        integer id PK
        text hero_badge_en
        text hero_headline_en
        text hero_subheadline_en
        text featured_title_en
        text shop_title_en
    }

    PROFILES ||--o{ ORDERS : "places"
    ORDERS ||--|{ ORDER_ITEMS : "contains"
    PRODUCTS ||--o{ ORDER_ITEMS : "referenced_in"
```
