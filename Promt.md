🚀 MASTER PROMPT — MARKETOS PLATFORM
Multi-Tenant Commerce SaaS Platform
1. CONTEXT & ROLE
Act as a Principal Software Architect, Senior Full-Stack Engineer, SaaS Product Designer and UI/UX Expert specialized in high-performance Progressive Web Applications (PWA), multi-tenant platforms and scalable commerce systems.
Apply engineering principles from:
- impeccable
- superpowers
- ui-ux-pro-max
- ECC
- ponytail
- clean architecture
- production-grade development practices
Your responsibility is not only to generate code, but to design a scalable commercial product that can support multiple businesses using the same platform.
Think like a startup engineering team building a SaaS product.
Before generating code:
1. Analyze the architecture.
2. Define the implementation strategy.
3. Preserve scalability.
4. Avoid unnecessary complexity.
5. Build reusable components.
6. Prioritize low operational costs.
7. Validate every architectural decision.
2. PROJECT VISION
Product Name
MarketOS
First Commercial Tenant
Shop Market C.A.
Business Category
Minimarket / Local Commerce
MarketOS is a multi-tenant digital commerce SaaS platform that allows independent businesses to have their own:
- Digital catalog.
- Online ordering system.
- Inventory management.
- Payment validation.
- Delivery management.
- Customer database.
- Promotions.
- Analytics.
Each business must feel like they have their own independent application.
3. BUSINESS PROBLEM
Many local businesses currently manage digital sales manually through WhatsApp.
Current problems:
- Customers ask repeatedly for prices.
- Inventory availability is manually checked.
- Currency conversion creates errors.
- Payment validation consumes employee time.
- Orders are lost in conversations.
- There is no structured customer history.
- There is no centralized digital commerce channel.
4. SOLUTION
Build a Progressive Web Application platform where customers can:
Discover products

↓

Add products

↓

Create order

↓

Select delivery method

↓

Submit payment proof

↓

Receive order confirmation


Businesses can:
Manage products

Manage inventory

Validate payments

Process orders

Manage customers

Analyze sales


5. TECHNOLOGY STACK
Use the following stack:
Frontend
Next.js 16 Stable
TypeScript
Tailwind CSS
PWA
App Router
Server Components
Server Actions

UI System
Use:
shadcn/ui
Lucide Icons
Tailwind Design Tokens

Requirements:
- Accessible components.
- Mobile-first.
- Highly customizable.
- Production quality.
Backend Layer
Do NOT create a separate Laravel backend initially.
Use:
Next.js Server Actions

Route Handlers

Middleware

Service Layer Architecture


The architecture must remain prepared for future backend extraction if required.
Database
Use:
Supabase PostgreSQL

Responsibilities:
- Business data.
- Products.
- Inventory.
- Orders.
- Customers.
- Roles.
- Permissions.
Authentication
Use:
Supabase Auth

Support:
Customers:
- Google OAuth.
- Facebook OAuth.
- Email.
- Magic Link.
- Guest checkout.
Employees:
- Email/password authentication.
Security
Implement:
Supabase Row Level Security (RLS)

The system MUST isolate data between tenants.
A business can NEVER access another business data.
Cache Layer
Use:
Upstash Redis

From the beginning.
Redis responsibilities:
- Product catalog cache.
- Shopping cart.
- Session optimization.
- BCV exchange rate cache.
- Inventory locking.
- Rate limiting.
- Background processing preparation.
File Storage
Use:
Cloudflare R2

Store:
- Product images.
- Business logos.
- Store banners.
- Payment proofs.
- Documents.
Deployment
Optimize for almost zero operational cost.
Target:
Frontend:
Vercel Free Tier

Database:
Supabase Free Tier

Redis:
Upstash Free Tier

Storage:
Cloudflare R2 Free/Low Cost


The architecture must consider future migration to VPS when revenue justifies it.
6. MULTI-TENANT ARCHITECTURE
This is a mandatory requirement.
MarketOS is NOT a single store application.
It must support:
MarketOS

   |

   ├── Shop Market C.A.

   ├── Minimarket Example

   └── Future Businesses


Each business is a tenant.
Database design must include:
tenant_id

in all relevant tables.
7. MULTI-STORE ARCHITECTURE
A tenant can have multiple locations.
Example:
Shop Market C.A.

|

├── Nueva Segovia

├── Centro

└── Cabudare


Create:
tenants

stores


Inventory and orders must belong to a specific store.
8. BUSINESS CUSTOMIZATION
Each tenant must have independent branding.
Example:
Shop Market:
Logo:
Shop Market

Colors:
Red / Black / White

Banner:
Promotions

WhatsApp:
Business number


Another business:
Different logo

Different colors

Different images

Different information


Create customizable settings:
tenant_settings

logo

primary_color

secondary_color

banner

business_name

phone

address

whatsapp

social_links


9. SHOP MARKET INITIAL CONFIGURATION
Tenant:
Shop Market C.A.

Category:
Minimarket

Address:

Calle 3 entre Carreras 1 y 2

Urb. Nueva Segovia

Barquisimeto, Lara


Phone:

+58 424-5919577


Email:

shopmarketca@gmail.com


10. CUSTOMER EXPERIENCE
Customer can choose:
Option 1
Guest purchase.
No account required.
Required:
Name

Phone

Address

Delivery information

Payment information


Option 2
Registered customer.
Benefits:
Order history

Saved addresses

Promotions

Favorites

Loyalty points

Faster checkout


11. SOCIAL LOGIN
Implement:
Google OAuth.
Facebook OAuth.
After authentication:
Create customer profile:
customers

id

auth_user_id

name

email

avatar

phone


12. CUSTOMER PURCHASE FLOW
Design this critical path:
Open Store

↓

Search Product

↓

Browse Categories

↓

Add Cart

↓

Checkout

↓

Select Delivery

↓

Select Payment

↓

Upload Proof

↓

Generate Order

↓

Receive Confirmation


13. PRODUCT CATALOG
Products must support:
Name

Description

Category

Brand

SKU

Barcode

Image

Price USD

Price VES

Stock

Status


Price system:
Base currency:
USD

Convert automatically:
USD × Exchange Rate


14. MULTI-CURRENCY ENGINE
Support:
USD

VES

EUR

COP


Create:
exchange_rates

currency

value

source

updated_at

tenant_id


The BCV exchange rate must be cached.
Example:
BCV API

↓

Redis

↓

Application


15. INVENTORY MODULE
Must support:
Products

Stock

Minimum stock

Inventory movements

Stock adjustments


Structure:
inventory

tenant_id

store_id

product_id

quantity


Future compatibility:
Prepare fields for external systems:
external_product_id

external_inventory_id


16. ORDER MANAGEMENT
Order statuses:
CREATED

PAYMENT_PENDING

PAYMENT_APPROVED

PREPARING

READY

DELIVERING

COMPLETED

CANCELLED


Order contains:
Customer

Store

Products

Quantities

Prices

Currency

Delivery

Payment


17. PAYMENT MANAGEMENT
Initial payment method:
Manual validation.
Customer:
Uploads:
Bank

Reference

Date

Amount

Screenshot


Administrator validates:
Pending

Approved

Rejected


Supported payment methods:
Configurable per tenant:
Pago móvil

Bank transfer

Zelle

Cash

POS

Other


Admin can enable/disable methods.
18. DELIVERY MODULE
Support:
Pickup

Delivery

Delivery zones:
Zone

Price

Availability


Future:
Drivers.
Create prepared structure:
drivers

id

tenant_id

name

phone

status


19. ADMINISTRATION SYSTEM
Three administration levels.
PLATFORM ADMIN
Your SaaS control panel.
Route:
/super-admin

Functions:
- Manage tenants.
- View metrics.
- Manage subscriptions future.
- Support.
- Platform analytics.
TENANT ADMIN
Business owner.
Route:
/admin

Functions:
- Products.
- Inventory.
- Orders.
- Employees.
- Customers.
- Settings.
EMPLOYEE ROLES
Implement:
OWNER

MANAGER

INVENTORY

CASHIER

DELIVERY


Permissions must be enforced.
20. DATABASE ARCHITECTURE
Create production-ready schema:
Main entities:
tenants

stores

users

profiles

roles

permissions

customers

tenant_customers

categories

products

inventory

inventory_movements

orders

order_items

payments

delivery_zones

drivers

exchange_rates

tenant_settings

audit_logs


21. AUDIT SYSTEM
Critical actions must be logged.
Examples:
User approved payment

User modified stock

User changed price

User changed settings


Create:
audit_logs


22. PROJECT STRUCTURE
Use scalable monorepo.
Example:
marketos/

apps/

 ├── web

      Customer storefronts

 ├── admin

      Tenant administration

 └── super-admin

      Platform administration


packages/

 ├── ui

 ├── database

 ├── auth

 ├── utils

 └── types

Use Turborepo with pnpm workspaces for the monorepo structure.


23. PERFORMANCE REQUIREMENTS
Optimize for:
Mobile devices.
Low bandwidth.
Affordable Android phones.
Targets:
Lighthouse Performance >90

Accessibility >95

Best Practices >95


24. PWA REQUIREMENTS
Implement:
Manifest

Service Worker (utiliza un paquete moderno y mantenido (como @ducanh2912/next-pwa o la futura integración nativa de Next.js) para evitar que genere código PWA obsoleto)

Install capability

Offline fallback

Cached catalog

Persistent cart


25. UI/UX PRINCIPLES
Follow:
- Mobile first.
- Large touch targets.
- Minimal checkout friction.
- Clear visual hierarchy.
- Fast feedback.
- Accessible design.
Avoid:
- Excessive animations.
- Heavy pages.
- Unnecessary steps.
26. DEVELOPMENT PHASES
Do NOT build everything at once.
PHASE 0
Foundation:
- Next.js setup.
- Authentication.
- Multi tenant architecture.
- Database schema.
- Design system.
PHASE 1
Shop Market MVP:
Customer:
- Catalog.
- Search.
- Categories.
- Cart.
- Checkout.
- Payment proof.
Admin:
- Products.
- Inventory.
- Orders.
- Payment validation.
PHASE 2
Operational:
- Delivery.
- Promotions.
- Customer accounts.
- Loyalty.
PHASE 3
SaaS:
- Multiple tenants.
- Subscription management.
- Automatic onboarding.
- Billing.
27. IMPORTANT ENGINEERING RULES
Do not create:
- hardcoded business logic.
- tenant-specific code.
- duplicated components.
- insecure database access.
Everything must be reusable.
Shop Market is only the first tenant.
28. FINAL OBJECTIVE
Create a production-quality SaaS foundation where:
Today:
Shop Market C.A.

can operate digitally.
Tomorrow:
100+ businesses

can use the same platform.
The system must be designed as a commercial product, not as a one-off website.


CRITICAL: All Supabase tables MUST have RLS enabled. Write explicit SQL policies ensuring that a user or admin can only read/write rows where tenant_id matches their assigned tenant."
END MASTER PROMPT
