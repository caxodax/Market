-- ==============================================================================
-- MIGRACIÓN 00011: CÉDULA DE IDENTIDAD / RIF DEL CLIENTE (CI / RIF)
-- MARKETOS DIGITAL COMMERCE - RASTREO Y VERIFICACIÓN EN MOSTRADOR
-- ==============================================================================

-- 1. AGREGAR id_number A LA TABLA DE CLIENTES (customers)
ALTER TABLE public.customers 
    ADD COLUMN IF NOT EXISTS id_number TEXT;

COMMENT ON COLUMN public.customers.id_number IS 
    'Cédula de Identidad o RIF del cliente venezolano (ej. V-12345678, E-81234567, J-50123456-7)';

-- 2. AGREGAR customer_id_number DENORMALIZADO A LA TABLA DE PEDIDOS (orders)
-- Permite preservar la Cédula histórica con la que se emitió cada pedido específico
ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS customer_id_number TEXT;

COMMENT ON COLUMN public.orders.customer_id_number IS 
    'Snapshot histórico de la Cédula/RIF del cliente al momento de generar la orden';

-- 3. ÍNDICES DE RENDIMIENTO PARA BÚSQUEDAS RÁPIDAS
-- Búsqueda combinada por tienda y cédula
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id_number 
    ON public.customers(tenant_id, id_number);

CREATE INDEX IF NOT EXISTS idx_customers_id_number 
    ON public.customers(id_number);

-- Búsqueda directa de órdenes por cédula
CREATE INDEX IF NOT EXISTS idx_orders_customer_id_number 
    ON public.orders(tenant_id, customer_id_number);
