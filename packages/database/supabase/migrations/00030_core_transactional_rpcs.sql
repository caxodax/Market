-- ==============================================================================
-- MARKETOS - MIGRATION 00030: CORE TRANSACTIONAL RPCS (STORED PROCEDURES)
-- Description:
--   High-performance ACID stored procedures for PostgreSQL / Supabase PostgREST RPC
--   1. rpc_create_order_atomic: Atomic order creation, coupon validation & stock/recipe deduction
--   2. rpc_issue_fiscal_document: Concurrency-locked SENIAT sequential numbering & double-entry NIIF journal
--   3. rpc_close_pos_shift: Atomic POS cash drawer closing, dual-currency audit & blind balancing
--   4. rpc_get_sales_book: Instant database-level SENIAT Sales Book generation
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ATOMIC ORDER CREATION & STOCK DEDUCTION (rpc_create_order_atomic)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_create_order_atomic(
  p_order_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id TEXT;
  v_store_id UUID;
  v_customer_id UUID;
  v_order_id UUID := gen_random_uuid();
  v_order_number TEXT;
  v_has_food_service BOOLEAN := FALSE;
  v_item JSONB;
  v_item_product_id UUID;
  v_item_product_name TEXT;
  v_item_quantity NUMERIC(12, 3);
  v_item_unit_price NUMERIC(12, 2);
  v_item_total_price NUMERIC(12, 2);
  v_item_modifiers JSONB;
  v_current_stock NUMERIC(12, 3);
  v_coupon_id UUID;
  v_recipe_record RECORD;
  v_recipe_item JSONB;
  v_mat_id UUID;
  v_mat_qty NUMERIC(12, 3);
  v_mat_stock NUMERIC(12, 3);
  v_mat_name TEXT;
BEGIN
  -- 1. Extraer identificadores base
  v_tenant_id := p_order_data->>'tenant_id';
  v_store_id := (p_order_data->>'store_id')::UUID;
  v_customer_id := (p_order_data->>'customer_id')::UUID;
  
  IF v_tenant_id IS NULL OR v_store_id IS NULL OR v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parametros tenant_id, store_id y customer_id son obligatorios');
  END IF;

  -- 2. Generar número de orden aleatorio único o usar el provisto
  v_order_number := COALESCE(
    p_order_data->>'order_number',
    'ORD-' || LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0')
  );

  -- 3. Detectar si el tenant tiene activo el módulo de gastronomía / recetas (food_service)
  SELECT COALESCE(is_active, FALSE) INTO v_has_food_service
  FROM public.tenant_modules
  WHERE tenant_id = v_tenant_id AND module_id = 'food_service';

  -- 4. Validar y procesar cupón de descuento si viene presente
  IF p_order_data->>'coupon_id' IS NOT NULL AND p_order_data->>'coupon_id' != '' THEN
    v_coupon_id := (p_order_data->>'coupon_id')::UUID;
    
    PERFORM 1 FROM public.coupons 
    WHERE id = v_coupon_id 
      AND tenant_id = v_tenant_id 
      AND is_active = TRUE 
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (usage_limit IS NULL OR usage_count < usage_limit)
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'El cupón de descuento no es válido o ha expirado');
    END IF;

    UPDATE public.coupons 
    SET usage_count = usage_count + 1 
    WHERE id = v_coupon_id;
  END IF;

  -- 5. Procesar renglones y descontar existencias atómicamente
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_data->'items')
  LOOP
    v_item_product_id := (v_item->>'product_id')::UUID;
    v_item_product_name := COALESCE(v_item->>'product_name', 'Producto');
    v_item_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 1.000);
    v_item_unit_price := COALESCE((v_item->>'unit_price_usd')::NUMERIC, 0.00);
    v_item_total_price := COALESCE((v_item->>'total_price_usd')::NUMERIC, v_item_unit_price * v_item_quantity);
    v_item_modifiers := v_item->'selected_modifiers';

    -- Si el negocio tiene food_service activo, verificar si el producto tiene receta (escandallo BOM)
    IF v_has_food_service = TRUE THEN
      SELECT * INTO v_recipe_record 
      FROM public.product_recipes 
      WHERE tenant_id = v_tenant_id AND product_id = v_item_product_id::TEXT;

      IF FOUND AND v_recipe_record.items IS NOT NULL AND jsonb_array_length(v_recipe_record.items) > 0 THEN
        -- Descontar insumos de la materia prima (raw_materials)
        FOR v_recipe_item IN SELECT * FROM jsonb_array_elements(v_recipe_record.items)
        LOOP
          v_mat_id := (v_recipe_item->>'raw_material_id')::UUID;
          v_mat_qty := (v_recipe_item->>'quantity')::NUMERIC * v_item_quantity;

          SELECT name, current_stock INTO v_mat_name, v_mat_stock
          FROM public.raw_materials
          WHERE id = v_mat_id AND tenant_id = v_tenant_id
          FOR UPDATE;

          IF v_mat_stock < v_mat_qty THEN
            RAISE EXCEPTION 'Stock insuficiente en cocina para el insumo % (Disponible: %, Requerido: %)', 
              v_mat_name, v_mat_stock, v_mat_qty;
          END IF;

          UPDATE public.raw_materials
          SET current_stock = current_stock - v_mat_qty,
              updated_at = NOW()
          WHERE id = v_mat_id;
        END LOOP;
      END IF;
    END IF;

    -- Para productos con control directo de inventario (Retail / Shop Market)
    SELECT quantity INTO v_current_stock 
    FROM public.inventory 
    WHERE tenant_id = v_tenant_id AND store_id = v_store_id AND product_id = v_item_product_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_current_stock < v_item_quantity THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto % (Disponible: %, Solicitado: %)', 
          v_item_product_name, v_current_stock, v_item_quantity;
      END IF;

      UPDATE public.inventory 
      SET quantity = quantity - v_item_quantity,
          updated_at = NOW()
      WHERE tenant_id = v_tenant_id AND store_id = v_store_id AND product_id = v_item_product_id;

      -- Registrar movimiento de auditoría de inventario
      INSERT INTO public.inventory_movements (
        tenant_id, store_id, product_id, quantity_change, previous_quantity, new_quantity, reason
      ) VALUES (
        v_tenant_id, v_store_id, v_item_product_id, -v_item_quantity, v_current_stock, (v_current_stock - v_item_quantity), 'VENTA_ORDEN_' || v_order_number
      );
    END IF;

    -- Insertar renglón del pedido
    INSERT INTO public.order_items (
      id, tenant_id, order_id, product_id, product_name, quantity, unit_price_usd, total_price_usd, created_at
    ) VALUES (
      gen_random_uuid(), v_tenant_id, v_order_id, v_item_product_id, v_item_product_name, v_item_quantity::INTEGER, v_item_unit_price, v_item_total_price, NOW()
    );
  END LOOP;

  -- 6. Insertar cabecera de la orden
  INSERT INTO public.orders (
    id, tenant_id, store_id, customer_id, order_number, status, delivery_type,
    delivery_address, total_usd, total_ves, total_primary, total_secondary,
    exchange_rate_applied, notes, delivery_zone_id, delivery_fee_usd, coupon_id,
    discount_usd, customer_id_number, created_at, updated_at
  ) VALUES (
    v_order_id,
    v_tenant_id,
    v_store_id,
    v_customer_id,
    v_order_number,
    COALESCE(p_order_data->>'status', 'CREATED')::public.order_status,
    COALESCE(p_order_data->>'delivery_type', 'PICKUP')::public.delivery_type,
    p_order_data->>'delivery_address',
    COALESCE((p_order_data->>'total_usd')::NUMERIC, 0.00),
    COALESCE((p_order_data->>'total_ves')::NUMERIC, 0.00),
    COALESCE((p_order_data->>'total_primary')::NUMERIC, (p_order_data->>'total_usd')::NUMERIC, 0.00),
    COALESCE((p_order_data->>'total_secondary')::NUMERIC, (p_order_data->>'total_ves')::NUMERIC, 0.00),
    COALESCE((p_order_data->>'exchange_rate_applied')::NUMERIC, 1.0000),
    p_order_data->>'notes',
    NULLIF(p_order_data->>'delivery_zone_id', '')::UUID,
    COALESCE((p_order_data->>'delivery_fee_usd')::NUMERIC, 0.00),
    v_coupon_id,
    COALESCE((p_order_data->>'discount_usd')::NUMERIC, 0.00),
    p_order_data->>'customer_id_number',
    NOW(),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_primary', COALESCE((p_order_data->>'total_primary')::NUMERIC, (p_order_data->>'total_usd')::NUMERIC, 0.00),
    'total_secondary', COALESCE((p_order_data->>'total_secondary')::NUMERIC, (p_order_data->>'total_ves')::NUMERIC, 0.00)
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Ante cualquier error (stock insuficiente, datos erróneos), Postgres hace ROLLBACK automático
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. EMISIÓN FISCAL ATÓMICA Y ASIENTO NIIF (rpc_issue_fiscal_document)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_issue_fiscal_document(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id TEXT;
  v_doc_type TEXT;
  v_next_seq INTEGER;
  v_doc_number TEXT;
  v_doc_id UUID := gen_random_uuid();
  v_entry_id UUID := gen_random_uuid();
  v_entry_number INTEGER := 1;
  v_total_amount NUMERIC(12, 2);
  v_subtotal_taxable NUMERIC(12, 2);
  v_iva_amount NUMERIC(12, 2);
  v_has_accounting BOOLEAN := FALSE;
BEGIN
  v_tenant_id := p_payload->>'tenant_id';
  v_doc_type := COALESCE(p_payload->>'document_type', 'INVOICE');
  v_total_amount := COALESCE((p_payload->>'total_amount')::NUMERIC, 0.00);
  v_subtotal_taxable := COALESCE((p_payload->>'subtotal_taxable')::NUMERIC, 0.00);
  v_iva_amount := COALESCE((p_payload->>'iva_amount')::NUMERIC, 0.00);

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'tenant_id es requerido');
  END IF;

  -- 1. Obtener correlativo consecutivo atómico con bloqueo FOR UPDATE
  v_next_seq := public.get_next_fiscal_sequence(v_tenant_id, v_doc_type);
  v_doc_number := 'FAC-' || LPAD(v_next_seq::TEXT, 8, '0');

  -- 2. Insertar el documento fiscal
  INSERT INTO public.fiscal_documents (
    id, tenant_id, order_id, document_type, document_number, control_number,
    status, customer_name, customer_id_doc, customer_address, customer_phone,
    emitter_business_name, emitter_id_doc, emitter_address, items,
    subtotal_exempt, subtotal_taxable, iva_rate_percent, iva_amount,
    igtf_rate_percent, igtf_amount, total_amount, total_ves, exchange_rate_applied,
    currency, payment_condition, payment_status, amount_paid, created_at, updated_at
  ) VALUES (
    v_doc_id,
    v_tenant_id,
    NULLIF(p_payload->>'order_id', '')::UUID,
    v_doc_type,
    v_doc_number,
    COALESCE(p_payload->>'control_number', 'CTRL-' || LPAD(v_next_seq::TEXT, 8, '0')),
    'ISSUED',
    COALESCE(p_payload->>'customer_name', 'Consumidor Final'),
    COALESCE(p_payload->>'customer_id_doc', 'V-00000000'),
    p_payload->>'customer_address',
    p_payload->>'customer_phone',
    COALESCE(p_payload->>'emitter_business_name', 'Comercio'),
    COALESCE(p_payload->>'emitter_id_doc', 'J-000000000'),
    COALESCE(p_payload->>'emitter_address', 'Venezuela'),
    COALESCE(p_payload->'items', '[]'::jsonb),
    COALESCE((p_payload->>'subtotal_exempt')::NUMERIC, 0.00),
    v_subtotal_taxable,
    COALESCE((p_payload->>'iva_rate_percent')::NUMERIC, 16.00),
    v_iva_amount,
    COALESCE((p_payload->>'igtf_rate_percent')::NUMERIC, 0.00),
    COALESCE((p_payload->>'igtf_amount')::NUMERIC, 0.00),
    v_total_amount,
    (p_payload->>'total_ves')::NUMERIC,
    (p_payload->>'exchange_rate_applied')::NUMERIC,
    COALESCE(p_payload->>'currency', 'USD'),
    COALESCE(p_payload->>'payment_condition', 'CASH'),
    'PAID',
    v_total_amount,
    NOW(),
    NOW()
  );

  -- 3. Generar Asiento Contable NIIF si el plugin de contabilidad está activo
  SELECT COALESCE(is_active, FALSE) INTO v_has_accounting
  FROM public.tenant_modules
  WHERE tenant_id = v_tenant_id AND module_id = 'accounting';

  IF v_has_accounting = TRUE THEN
    SELECT COALESCE(MAX(entry_number), 0) + 1 INTO v_entry_number
    FROM public.journal_entries
    WHERE tenant_id = v_tenant_id;

    -- Cabecera del asiento
    INSERT INTO public.journal_entries (
      id, tenant_id, entry_number, entry_date, concept, source_module,
      source_document_id, source_document_number, total_debit, total_credit,
      is_balanced, created_at, updated_at
    ) VALUES (
      v_entry_id,
      v_tenant_id,
      v_entry_number,
      CURRENT_DATE,
      'Venta según Factura Fiscal ' || v_doc_number,
      'INVOICING',
      v_doc_id,
      v_doc_number,
      v_total_amount,
      v_total_amount,
      TRUE,
      NOW(),
      NOW()
    );

    -- Línea 1: Débito en Caja / Banco (Activo)
    INSERT INTO public.journal_entry_lines (
      id, entry_id, tenant_id, account_code, account_name, description, debit, credit, line_order
    ) VALUES (
      gen_random_uuid(), v_entry_id, v_tenant_id, '1.1.01.01', 'Caja General / Banco', 'Cobro de factura ' || v_doc_number, v_total_amount, 0.00, 1
    );

    -- Línea 2: Crédito en Ventas (Ingreso)
    INSERT INTO public.journal_entry_lines (
      id, entry_id, tenant_id, account_code, account_name, description, debit, credit, line_order
    ) VALUES (
      gen_random_uuid(), v_entry_id, v_tenant_id, '4.1.01.01', 'Ventas de Mercancía', 'Venta base factura ' || v_doc_number, 0.00, (v_total_amount - v_iva_amount), 2
    );

    -- Línea 3: Crédito en IVA por Pagar (Pasivo Fiscal)
    IF v_iva_amount > 0 THEN
      INSERT INTO public.journal_entry_lines (
        id, entry_id, tenant_id, account_code, account_name, description, debit, credit, line_order
      ) VALUES (
        gen_random_uuid(), v_entry_id, v_tenant_id, '2.1.03.01', 'Débito Fiscal IVA 16%', 'IVA generado ' || v_doc_number, 0.00, v_iva_amount, 3
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'document_id', v_doc_id,
    'document_number', v_doc_number,
    'control_number', 'CTRL-' || LPAD(v_next_seq::TEXT, 8, '0'),
    'sequence', v_next_seq,
    'accounting_entry_id', CASE WHEN v_has_accounting THEN v_entry_id ELSE NULL END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. CIERRE DE TURNO POS Y ARQUEO CIEGO (rpc_close_pos_shift)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_close_pos_shift(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_id UUID;
  v_tenant_id TEXT;
  v_close_type TEXT;
  v_closing_primary NUMERIC(12, 2);
  v_closing_secondary NUMERIC(14, 2);
  v_shift RECORD;
  v_cash_in NUMERIC(12, 2) := 0.00;
  v_cash_out NUMERIC(12, 2) := 0.00;
  v_expected_primary NUMERIC(12, 2) := 0.00;
  v_diff_primary NUMERIC(12, 2) := 0.00;
BEGIN
  v_shift_id := (p_payload->>'shift_id')::UUID;
  v_tenant_id := p_payload->>'tenant_id';
  v_close_type := COALESCE(p_payload->>'close_type', 'X');
  v_closing_primary := COALESCE((p_payload->>'closing_cash_primary')::NUMERIC, (p_payload->>'closing_balance')::NUMERIC, 0.00);
  v_closing_secondary := COALESCE((p_payload->>'closing_cash_secondary')::NUMERIC, 0.00);

  -- 1. Obtener turno con bloqueo
  SELECT * INTO v_shift
  FROM public.cash_shifts
  WHERE id = v_shift_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Turno no encontrado');
  END IF;

  -- 2. Calcular entradas y salidas manuales de caja
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'IN' THEN amount_usd ELSE 0 END), 0.00),
    COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount_usd ELSE 0 END), 0.00)
  INTO v_cash_in, v_cash_out
  FROM public.cash_movements
  WHERE shift_id = v_shift_id;

  -- 3. Calcular saldo esperado en moneda primaria ($)
  v_expected_primary := COALESCE(v_shift.opening_cash_primary, v_shift.opening_balance, 0.00) + 
                        COALESCE(v_shift.total_sales_usd, 0.00) + 
                        v_cash_in - v_cash_out;
  v_diff_primary := v_closing_primary - v_expected_primary;

  -- 4. Cerrar turno en BD
  UPDATE public.cash_shifts
  SET closed_at = NOW(),
      close_type = v_close_type,
      closing_balance = v_closing_primary,
      closing_cash_primary = v_closing_primary,
      closing_cash_secondary = v_closing_secondary,
      expected_balance = v_expected_primary,
      expected_cash_primary = v_expected_primary,
      difference = v_diff_primary,
      difference_primary = v_diff_primary,
      total_cash_in = v_cash_in,
      total_cash_out = v_cash_out,
      ticket_printed = TRUE
  WHERE id = v_shift_id;

  RETURN jsonb_build_object(
    'success', true,
    'shift_id', v_shift_id,
    'close_type', v_close_type,
    'opening_cash_primary', COALESCE(v_shift.opening_cash_primary, v_shift.opening_balance),
    'closing_cash_primary', v_closing_primary,
    'closing_cash_secondary', v_closing_secondary,
    'expected_cash_primary', v_expected_primary,
    'difference_primary', v_diff_primary,
    'total_cash_in', v_cash_in,
    'total_cash_out', v_cash_out
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. VISTA AGREGADA: LIBRO DE VENTAS SENIAT (rpc_get_sales_book)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_sales_book(
  p_tenant_id TEXT,
  p_year_month TEXT -- Formato 'YYYY-MM'
)
RETURNS TABLE (
  doc_id UUID,
  doc_date DATE,
  doc_number TEXT,
  control_number TEXT,
  customer_name TEXT,
  customer_tax_id TEXT,
  subtotal_exempt NUMERIC,
  subtotal_taxable NUMERIC,
  iva_rate NUMERIC,
  iva_amount NUMERIC,
  igtf_amount NUMERIC,
  total_amount NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id AS doc_id,
    created_at::DATE AS doc_date,
    document_number AS doc_number,
    control_number,
    customer_name,
    customer_id_doc AS customer_tax_id,
    COALESCE(subtotal_exempt, 0.00) AS subtotal_exempt,
    COALESCE(subtotal_taxable, 0.00) AS subtotal_taxable,
    COALESCE(iva_rate_percent, 16.00) AS iva_rate,
    COALESCE(iva_amount, 0.00) AS iva_amount,
    COALESCE(igtf_amount, 0.00) AS igtf_amount,
    COALESCE(total_amount, 0.00) AS total_amount
  FROM public.fiscal_documents
  WHERE tenant_id = p_tenant_id
    AND TO_CHAR(created_at, 'YYYY-MM') = p_year_month
    AND status = 'ISSUED'
  ORDER BY created_at ASC;
$$;
