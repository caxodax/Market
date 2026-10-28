-- ==============================================================================
-- 00028_atomic_fiscal_sequences.sql
-- AgentShield & Ponytail: Atomic Race-Condition Free Fiscal Sequential Numbering
-- ==============================================================================

-- 1. Secuencias correlativas por comercio y tipo de documento fiscal
CREATE TABLE IF NOT EXISTS public.tenant_fiscal_sequences (
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, document_type)
);

-- RLS para secuencias fiscales
ALTER TABLE public.tenant_fiscal_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for tenant_fiscal_sequences"
  ON public.tenant_fiscal_sequences
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- 2. Restricción única en documentos fiscales para prevenir duplicados a nivel de motor SQL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_fiscal_documents_tenant_type_num'
  ) THEN
    ALTER TABLE public.fiscal_documents
      ADD CONSTRAINT uq_fiscal_documents_tenant_type_num
      UNIQUE (tenant_id, document_type, document_number);
  END IF;
END $$;

-- 3. Función atómica con bloqueo a nivel de fila (Row-Level Locking)
-- Garantiza incremento monótono sin saltos ni colisiones concurrentes
CREATE OR REPLACE FUNCTION public.get_next_fiscal_sequence(
  p_tenant_id TEXT,
  p_document_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_next_seq INTEGER;
  v_initial_max INTEGER;
BEGIN
  -- Si no existe registro de secuencia previa, inicializar con el máximo actual de la tabla
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_fiscal_sequences 
    WHERE tenant_id = p_tenant_id AND document_type = p_document_type
  ) THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(document_number, '\D', '', 'g'), '')::INTEGER), 0)
    INTO v_initial_max
    FROM public.fiscal_documents
    WHERE tenant_id = p_tenant_id AND document_type = p_document_type;

    INSERT INTO public.tenant_fiscal_sequences (tenant_id, document_type, last_sequence, updated_at)
    VALUES (p_tenant_id, p_document_type, v_initial_max, NOW())
    ON CONFLICT (tenant_id, document_type) DO NOTHING;
  END IF;

  -- Incremento atómico transaccional garantizado por Postgres
  UPDATE public.tenant_fiscal_sequences
  SET last_sequence = last_sequence + 1,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id AND document_type = p_document_type
  RETURNING last_sequence INTO v_next_seq;

  RETURN v_next_seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
