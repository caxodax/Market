-- ==============================================================================
-- MARKETOS - MIGRATION 00034: DECOUPLE CORE RPCS & DEADLOCK PREVENTION
-- Description:
--   1. Hardens rpc_create_order_atomic with deterministic item sorting (ORDER BY product_id ASC)
--      to eliminate deadlocks during concurrent flash sales and high-traffic checkout.
--   2. Ensures dynamic verification of tenant_modules ('food_service', 'craft_workshop')
--      without rigid coupling in the Core schema.
--   3. Guarantees canonical bimonetary persistence (total_primary, total_secondary,
--      exchange_rate_applied).
-- ==============================================================================

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
  v_has_craft_workshop BOOLEAN := FALSE;
  v_item JSONB;
  v_item_product_id UUID;
  v_item_product_name TEXT;
  v_item_quantity NUMERIC(12, 3);
  v_item_unit_price NUMERIC(12, 2);
  v_item_total_price NUMERIC(12, 2);
  v_current_stock NUMERIC(12, 3);
  v_coupon_id UUID;
  v_recipe_record RECORD;
  v_recipe_item JSONB;
  v_mat_id UUID;
  v_mat_qty NUMERIC(12, 3);
  v_mat_stock NUMERIC(12, 3);
  v_mat_name TEXT;
  v_total_primary NUMERIC(12, 2);
  v_total_secondary NUMERIC(14, 2);
  v_rate NUMERIC(14, 4);
BEGIN
  -- 1. Extraer identificadores base
  v_tenant_id := p_order_data->>'tenant_id';
  v_store_id := (p_order_data->>'store_id')::UUID;
  v_customer_id := (p_order_data->>'customer_id')::UUID;
  
  IF v_tenant_id IS NULL OR v_store_id IS NULL OR v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parametros tenant_id, store_id y customer_id son obligatorios');
  END IF;

  -- 2. Generar número de orden único o usar el provisto
  v_order_number := COALESCE(
    p_order_data->>'order_number',
    'ORD-' || LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0')
  );

  -- 3. Detectar dinámicamente módulos activos en tenant_modules
  SELECT COALESCE(is_active, FALSE) INTO v_has_food_service
  FROM public.tenant_modules
  WHERE tenant_id = v_tenant_id AND module_id = 'food_service';

  SELECT COALESCE(is_active, FALSE) INTO v_has_craft_workshop
  FROM public.tenant_modules
  WHERE tenant_id = v_tenant_id AND module_id = 'craft_workshop';

  -- 4. Validar y procesar cupón de descuento con bloqueo exclusivo si viene presente
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
  -- PREVENCIÓN DE DEADLOCKS: Ordenar determinísticamente por product_id ASC antes de bloquear filas
  FOR v_item IN 
    SELECT value 
    FROM jsonb_array_elements(p_order_data->'items')
    ORDER BY (value->>'product_id')::TEXT ASC
  LOOP
    v_item_product_id := (v_item->>'product_id')::UUID;
    v_item_product_name := COALESCE(v_item->>'product_name', 'Producto');
    v_item_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 1.000);
    v_item_unit_price := COALESCE((v_item->>'unit_price_usd')::NUMERIC, (v_item->>'unit_price')::NUMERIC, 0.00);
    v_item_total_price := COALESCE((v_item->>'total_price_usd')::NUMERIC, (v_item->>'total_price')::NUMERIC, v_item_unit_price * v_item_quantity);

    -- Estrategia A: Si tiene food_service activo, verificar si el producto tiene receta de cocina (escandallo BOM)
    IF v_has_food_service = TRUE THEN
      SELECT * INTO v_recipe_record 
      FROM public.recipes 
      WHERE tenant_id = v_tenant_id AND product_id = v_item_product_id;

      IF FOUND AND v_recipe_record.items IS NOT NULL AND jsonb_array_length(v_recipe_record.items) > 0 THEN
        FOR v_recipe_item IN 
          SELECT value FROM jsonb_array_elements(v_recipe_record.items)
          ORDER BY (value->>'raw_material_id')::TEXT ASC
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

    -- Estrategia B: Deducción estándar de stock en almacén/tienda (Retail)
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

      -- Registrar movimiento de auditoría en kardex
      INSERT INTO public.inventory_movements (
        id, tenant_id, store_id, product_id, type, quantity_delta, previous_quantity, new_quantity, reference_id, created_at
      ) VALUES (
        gen_random_uuid(), v_tenant_id, v_store_id, v_item_product_id, 'SALE', -v_item_quantity, v_current_stock, (v_current_stock - v_item_quantity), 'VENTA_' || v_order_number, NOW()
      );
    END IF;

    -- Insertar renglón del pedido
    INSERT INTO public.order_items (
      id, tenant_id, order_id, product_id, product_name, quantity, unit_price, total_price, selected_modifiers, created_at
    ) VALUES (
      gen_random_uuid(), v_tenant_id, v_order_id, v_item_product_id, v_item_product_name, v_item_quantity, v_item_unit_price, v_item_total_price, COALESCE(v_item->'selected_modifiers', '[]'::jsonb), NOW()
    );
  END LOOP;

  -- 6. Calcular montos bimonetarios canónicos
  v_total_primary := COALESCE((p_order_data->>'total_primary')::NUMERIC, (p_order_data->>'total_usd')::NUMERIC, 0.00);
  v_total_secondary := COALESCE((p_order_data->>'total_secondary')::NUMERIC, (p_order_data->>'total_ves')::NUMERIC, 0.00);
  v_rate := COALESCE((p_order_data->>'exchange_rate_applied')::NUMERIC, 1.0000);

  -- 7. Insertar cabecera de la orden
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
    v_total_primary,
    v_total_secondary,
    v_total_primary,
    v_total_secondary,
    v_rate,
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
    'total_primary', v_total_primary,
    'total_secondary', v_total_secondary
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;
