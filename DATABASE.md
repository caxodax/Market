# Database Design


## tenants

Represents businesses using the SaaS.


Fields:

id

name

logo

status



## stores

Represents physical locations.


Fields:

id

tenant_id

name

address


## exchange_rates

Stores exchange rates per tenant or system-wide fallback.
Primary automated source for USD/VES: `https://bcv.today/api/` (Endpoint: `https://bcv.today/api/v1/rate.json`)

Fields:

id

tenant_id

currency

value

source

updated_at


