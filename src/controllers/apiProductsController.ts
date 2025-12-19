import { Request, Response } from 'express';
import supabase from '../lib/supabase.js';
import calcPriceLevels from '../utils/price.js';

function parseBool(val: any) {
  if (val === undefined || val === null) return false;
  if (typeof val === 'boolean') return val;
  const s = String(val).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

export const getProducts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const pageSize = Math.max(1, parseInt(String(req.query.pageSize || '25'), 10));
    const q = (req.query.q as string) || '';
    let categoryId = req.query.categoryId as string | undefined;
    let supplierId = req.query.supplierId as string | undefined;
    const lowStock = parseBool(req.query.lowStock);

    const isUuid = (s: string) => /^[0-9a-fA-F\-]{36}$/.test(String(s || ''));

    // Resolve category/supplier names -> ids when needed
    if (categoryId && !isUuid(categoryId)) {
      try {
        const { data: cat, error: catErr } = await supabase.from('categorias').select('id').ilike('nombre', categoryId).limit(1).single();
        if (!catErr && cat && cat.id) categoryId = cat.id;
        else categoryId = undefined;
      } catch (e) { categoryId = undefined; }
    }
    if (supplierId && !isUuid(supplierId)) {
      try {
        const { data: sup, error: supErr } = await supabase.from('proveedores').select('id').ilike('nombre', supplierId).limit(1).single();
        if (!supErr && sup && sup.id) supplierId = sup.id;
        else supplierId = undefined;
      } catch (e) { supplierId = undefined; }
    }

    // Build base query against Spanish tables and include proveedor relation
    // We'll select Spanish columns and map to response shape later
    let prodQuery = supabase.from('productos').select(
      'id,sku,nombre,descripcion,costo,precio_1,precio_2,precio_3,stock_minimo,unidad,imagen_path, proveedor:proveedores(id,nombre)',
      { count: 'exact' }
    );

    if (q) {
      const esc = q.replace(/%/g, '\%');
      prodQuery = prodQuery.or(`nombre.ilike.%${esc}%,sku.ilike.%${esc}%`);
    }
    if (categoryId) prodQuery = prodQuery.eq('categoria_id', categoryId);
    if (supplierId) prodQuery = prodQuery.eq('proveedor_id', supplierId);

    const normalizeSupplier = (raw: any) => {
      if (!raw) return { id: null, name: null };
      const s = Array.isArray(raw) ? (raw[0] || null) : raw;
      if (!s) return { id: null, name: null };
      return {
        id: s.id ?? null,
        name: s.nombre ?? s.name ?? s.razon_social ?? null,
        image_url: s.image_url ?? undefined,
        email: s.email ?? undefined,
        phone: s.phone ?? undefined
      };
    };

    // If lowStock requested we must fetch all matching products and compute stock server-side
    if (lowStock) {
      const { data: allProducts, error: prodErr } = await prodQuery;
      if (prodErr) return res.status(500).json({ error: prodErr.message || prodErr });
      const productIds = (allProducts || []).map((p: any) => p.id).filter(Boolean);

      const { data: stockRows, error: stockErr } = await supabase
        .from('stock_productos')
        .select('producto_id, cantidad')
        .in('producto_id', productIds || []);
      if (stockErr) return res.status(500).json({ error: stockErr.message || stockErr });

      const qtyByProduct: Record<string, number> = {};
      (stockRows || []).forEach((r: any) => {
        const qv = Number(r.cantidad) || 0;
        qtyByProduct[r.producto_id] = (qtyByProduct[r.producto_id] || 0) + qv;
      });

      const transformed = (allProducts || []).map((p: any) => {
        const stock = qtyByProduct[p.id] || 0;
        const supplier = normalizeSupplier(p.proveedor);
        const out: any = {
          id: p.id,
          sku: p.sku,
          name: p.nombre,
          description: p.descripcion,
          unit: p.unidad,
          cost: p.costo,
          price1: p.precio_1,
          price2: p.precio_2,
          price3: p.precio_3,
          min_stock: p.stock_minimo,
          stock,
          supplier
        };
        try {
          if (p.imagen_path) {
            let path = String(p.imagen_path || '').trim();
            if (path.startsWith('http')) out.image_url = path;
            else {
              path = path.replace(/^\/?product-images\//i, '');
              const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
              if (urlData && (urlData as any).publicUrl) out.image_url = (urlData as any).publicUrl;
            }
          }
        } catch (e) {}
        // ensure price totals are present (compute from cost if needed)
        try {
          if ((out.price1 === undefined || out.price1 === null) && out.cost !== undefined && out.cost !== null) {
            const prices = calcPriceLevels(Number(out.cost));
            out.price1 = prices.price1.total;
            out.price2 = prices.price2.total;
            out.price3 = prices.price3.total;
          }
        } catch (e) {}
        return out;
      }).filter((p: any) => p.stock < (p.min_stock || 0));

      const totalItems = transformed.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const start = (page - 1) * pageSize;
      return res.json({ data: transformed.slice(start, start + pageSize), page, pageSize, totalPages, totalItems });
    }

    // Normal paged case
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await prodQuery.range(from, to);
    if (error) return res.status(500).json({ error: error.message || error });

    const ids = (data || []).map((p: any) => p.id).filter(Boolean);
    const stockMap: Record<string, number> = {};
    if (ids.length) {
      const { data: stocks } = await supabase.from('stock_productos').select('producto_id, cantidad').in('producto_id', ids);
      (stocks || []).forEach((r: any) => {
        const qv = Number(r.cantidad) || 0;
        stockMap[r.producto_id] = (stockMap[r.producto_id] || 0) + qv;
      });
    }

    const enriched = (data || []).map((p: any) => {
      const supplier = normalizeSupplier(p.proveedor);
      const out: any = {
        id: p.id,
        sku: p.sku,
        name: p.nombre,
        description: p.descripcion,
        unit: p.unidad,
        cost: p.costo,
        price1: p.precio_1,
        price2: p.precio_2,
        price3: p.precio_3,
        min_stock: p.stock_minimo,
        stock: stockMap[p.id] || 0,
        supplier
      };
      try {
        if (p.imagen_path) {
          let path = String(p.imagen_path || '').trim();
          if (path.startsWith('http')) out.image_url = path;
          else {
            path = path.replace(/^\/?product-images\//i, '');
            const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
            if (urlData && (urlData as any).publicUrl) out.image_url = (urlData as any).publicUrl;
          }
        }
      } catch (e) {}

      try {
        if ((out.price1 === undefined || out.price1 === null) && out.cost !== undefined && out.cost !== null) {
          const prices = calcPriceLevels(Number(out.cost));
          out.price1 = prices.price1.total;
          out.price2 = prices.price2.total;
          out.price3 = prices.price3.total;
        }
      } catch (e) {}

      return out;
    });

    const totalItems = typeof count === 'number' ? count : enriched.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    return res.json({ data: enriched, page, pageSize, totalPages, totalItems });
  } catch (err: any) {
    console.error('getProducts error', err);
    return res.status(500).json({ error: err.message || err });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing product id' });
    const payload: any = {};
    // Accept common (possibly English) input keys from clients, we'll map to Spanish DB columns before updating
    const allowed = ['name', 'sku', 'cost', 'min_stock', 'supplier', 'category_id', 'unit'];
    for (const k of allowed) {
      if (req.body[k] !== undefined) payload[k] = req.body[k];
    }
    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No fields to update' });

    // Handle supplier: user may send supplier as name or as supplier_id
    // Handle supplier: user may send supplier as name or as supplier_id
    if (payload.supplier !== undefined) {
      const maybe = String(payload.supplier || '').trim();
      const isUuid = /^[0-9a-fA-F\-]{36}$/.test(maybe);
      try {
        if (isUuid) {
          payload.proveedor_id = maybe;
        } else if (maybe.length > 0) {
          const { data: existing, error: findErr } = await supabase.from('proveedores').select('id').ilike('nombre', maybe).limit(1).single();
          if (!findErr && existing && existing.id) {
            payload.proveedor_id = existing.id;
          } else {
            const { data: ins, error: insErr } = await supabase.from('proveedores').insert({ nombre: maybe }).select().single();
            if (!insErr && ins && ins.id) payload.proveedor_id = ins.id;
          }
        }
      } catch (e) {
        console.warn('supplier lookup/insert failed', e);
      }
      delete payload.supplier;
    }

    // If cost is present in payload, compute price levels and include numeric totals in payload
    if (payload.cost !== undefined && payload.cost !== null && !isNaN(Number(payload.cost))) {
      try {
        const prices = calcPriceLevels(Number(payload.cost));
        // persist totals and breakdown so later reads don't need to recalc
        // Persist the three price tiers using Spanish column names. Do NOT write breakdown fields (they don't exist in productos).
        payload.precio_1 = prices.price1.total;
        payload.precio_2 = prices.price2.total;
        payload.precio_3 = prices.price3.total;
      } catch (e) {
        // ignore calculation error and proceed without price fields
      }
    }

    // Map accepted input keys to Spanish DB columns
    const dbPayload: any = {};
    if (payload.name !== undefined) dbPayload.nombre = payload.name;
    if (payload.sku !== undefined) dbPayload.sku = payload.sku;
    if (payload.cost !== undefined) dbPayload.costo = payload.cost;
    if (payload.min_stock !== undefined) dbPayload.stock_minimo = payload.min_stock;
    if (payload.category_id !== undefined) dbPayload.categoria_id = payload.category_id;
    if (payload.unit !== undefined) dbPayload.unidad = payload.unit;
    if (payload.proveedor_id !== undefined) dbPayload.proveedor_id = payload.proveedor_id;
    if (payload.precio_1 !== undefined) dbPayload.precio_1 = payload.precio_1;
    if (payload.precio_2 !== undefined) dbPayload.precio_2 = payload.precio_2;
    if (payload.precio_3 !== undefined) dbPayload.precio_3 = payload.precio_3;

    console.debug('updateProduct dbPayload keys:', Object.keys(dbPayload));
    let { data, error } = await supabase.from('productos').update(dbPayload).eq('id', id).select().single();
    if (error) {
      // If the error indicates missing columns (schema doesn't include the price breakdown fields),
      // strip those fields and retry the update so edits still succeed.
      const msg = (error && (error.message || error)) || '';
      const missingColPattern = /Could not find the|column .* does not exist|missing column/i;
      if (typeof msg === 'string' && missingColPattern.test(msg)) {
        console.warn('Update failed due to missing columns, retrying without price breakdown fields:', msg);
        // remove any keys that start with price1_/price2_/price3_ or price1, price2, price3 totals
        const altPayload: any = {};
        // Build a conservative altPayload mapping to Spanish columns, skipping precio_* fields if they caused issues
        for (const k of Object.keys(payload)) {
          if (/^price(1|2|3)(_|$)/.test(k)) continue;
          if (k === 'supplier' || /^supplier_/.test(k)) continue;
          if (k === 'name') altPayload.nombre = payload[k];
          else if (k === 'sku') altPayload.sku = payload[k];
          else if (k === 'cost') altPayload.costo = payload[k];
          else if (k === 'min_stock') altPayload.stock_minimo = payload[k];
          else if (k === 'category_id') altPayload.categoria_id = payload[k];
          else if (k === 'unit') altPayload.unidad = payload[k];
        }
        const r = await supabase.from('productos').update(altPayload).eq('id', id).select().single();
        data = r.data;
        if (r.error) {
          console.error('Retry update without price fields failed:', r.error);
          return res.status(500).json({ error: r.error.message || r.error });
        }
      } else {
        return res.status(500).json({ error: error.message || error });
      }
    }

    // compute current stock
    const { data: stocks, error: stockErr } = await supabase.from('stock_productos').select('cantidad').eq('producto_id', id);
    if (stockErr) console.warn('stock fetch error', stockErr);
    const totalStock = (stocks || []).reduce((s: number, r: any) => s + (Number(r.cantidad) || 0), 0);

    // Ensure returned object contains computed price fields (in case cost wasn't updated but DB lacks price fields)
    const out: any = { ...data, stock: totalStock };
    try {
      if (out.cost !== undefined && out.cost !== null && !isNaN(Number(out.cost))) {
        const prs = calcPriceLevels(Number(out.cost));
        out.price1 = prs.price1.total;
        out.price2 = prs.price2.total;
        out.price3 = prs.price3.total;
        out.price1_subtotal = prs.price1.subtotal;
        out.price1_iva = prs.price1.iva;
        out.price1_total = prs.price1.total;
        out.price2_subtotal = prs.price2.subtotal;
        out.price2_iva = prs.price2.iva;
        out.price2_total = prs.price2.total;
        out.price3_subtotal = prs.price3.subtotal;
        out.price3_iva = prs.price3.iva;
        out.price3_total = prs.price3.total;
      }
    } catch (e) {
      // ignore
    }

    return res.json({ data: out });
  } catch (err: any) {
    console.error('updateProduct error', err);
    return res.status(500).json({ error: err.message || err });
  }
};

export const adjustStock = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing product id' });
    const qty = Number(req.body.qty || 0);
    const reason = String(req.body.reason || '');

    if (!Number.isFinite(qty) || qty === 0) return res.status(400).json({ error: 'qty must be non-zero number' });

    const insert = { product_id: id, qty, reason, created_at: new Date().toISOString() } as any;
    // Insert adjustment into movimientos_inventario and also add a stock_productos row
    const { data: ins, error: insErr } = await supabase.from('movimientos_inventario').insert({
      producto_id: id,
      almacen_id: req.body.almacen_id || null,
      tipo: 'ajuste',
      cantidad: qty,
      referencia: reason,
      creado_por: (req as any).user?.id || null,
      creado_en: new Date().toISOString()
    }).select();
    if (insErr) return res.status(500).json({ error: insErr.message || insErr });

    // Optionally update stock_productos (append a row with cantidad) — keep additive behaviour
    try {
      await supabase.from('stock_productos').insert({ producto_id: id, almacen_id: req.body.almacen_id || null, cantidad: qty, actualizado_en: new Date().toISOString() });
    } catch (e) { /* ignore */ }

    // recompute stock
    const { data: stocks, error: stockErr } = await supabase.from('stock_productos').select('cantidad').eq('producto_id', id);
    if (stockErr) return res.status(500).json({ error: stockErr.message || stockErr });
    const totalStock = (stocks || []).reduce((s: number, r: any) => s + (Number(r.cantidad) || 0), 0);

    return res.json({ data: { product_id: id, stock: totalStock, inserted: ins } });
  } catch (err: any) {
    console.error('adjustStock error', err);
    return res.status(500).json({ error: err.message || err });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing product id' });

    // Use relational alias to fetch proveedor and categoria from Spanish tables
    const { data: productRow, error: prodErr } = await supabase
      .from('productos')
      .select('id,sku,nombre,descripcion,costo,precio_1,precio_2,precio_3,stock_minimo,unidad,imagen_path, proveedor:proveedores(id,nombre), categoria:categorias(id,nombre)')
      .eq('id', id)
      .single();

    if (prodErr || !productRow) return res.status(404).json({ error: prodErr?.message || 'Product not found' });

    // Normalize supplier to single object {id,name} or {id:null,name:null}
    const rawSupplier = (productRow as any).proveedor;
    let supplierObj: { id: string | null; name: string | null };
    if (!rawSupplier) {
      supplierObj = { id: null, name: null };
    } else {
      const s = Array.isArray(rawSupplier) ? (rawSupplier[0] || null) : rawSupplier;
      if (!s) {
        supplierObj = { id: null, name: null };
      } else {
        supplierObj = {
          id: s.id ?? null,
          name: s.nombre ?? s.name ?? s.razon_social ?? null
        };
      }
    }

    // Normalize category to single object {id,name} or null
    const rawCategory = (productRow as any).categoria;
    let categoryObj: { id: string | null; name: string | null } | null = null;
    if (rawCategory) {
      const c = Array.isArray(rawCategory) ? (rawCategory[0] || null) : rawCategory;
      if (c) categoryObj = { id: c.id ?? null, name: c.nombre ?? c.name ?? c.razon_social ?? null };
    }

    // Sum stock_productos.cantidad to compute total stock
    const { data: stocks, error: stockErr } = await supabase.from('stock_productos').select('cantidad').eq('producto_id', id);
    if (stockErr) console.warn('stock fetch error', stockErr);
    const totalStock = (stocks || []).reduce((s: number, r: any) => s + (Number(r.cantidad) || 0), 0);

    // Determine price totals: prefer stored values, otherwise compute from cost
    let p1 = (productRow as any).precio_1;
    let p2 = (productRow as any).precio_2;
    let p3 = (productRow as any).precio_3;
    if ((p1 === undefined || p1 === null) && (productRow as any).costo !== undefined && (productRow as any).costo !== null) {
      try {
        const prs = calcPriceLevels(Number((productRow as any).costo));
        p1 = prs.price1.total;
        p2 = prs.price2.total;
        p3 = prs.price3.total;
      } catch (e) {
        // ignore
      }
    }

    // Attach public image_url from image_path if present
    let image_url: string | undefined = undefined;
    try {
      if (productRow.imagen_path) {
        let path = String(productRow.imagen_path || '').trim();
        if (path.startsWith('http')) {
          image_url = path;
        } else {
          path = path.replace(/^\/?product-images\//i, '');
          const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
          image_url = (urlData && urlData.publicUrl) || undefined;
        }
      }
    } catch (e) { /* ignore */ }

    // Return object compatible with listing endpoint
    // If supplier or category name is missing but id exists, try explicit lookup to retrieve 'nombre'
    try {
      if (supplierObj && !supplierObj.name && supplierObj.id) {
        const { data: supRow } = await supabase.from('proveedores').select('id,nombre,razon_social,name').eq('id', supplierObj.id).limit(1).single();
        if (supRow) supplierObj.name = supRow.nombre ?? supRow.name ?? supRow.razon_social ?? supplierObj.name;
      }
    } catch (e) { /* ignore lookup failure */ }
    try {
      if (categoryObj && !categoryObj.name && categoryObj.id) {
        const { data: catRow } = await supabase.from('categorias').select('id,nombre,razon_social,name').eq('id', categoryObj.id).limit(1).single();
        if (catRow) categoryObj.name = catRow.nombre ?? catRow.name ?? catRow.razon_social ?? categoryObj.name;
      }
    } catch (e) { /* ignore lookup failure */ }

    return res.json({ data: {
      id: productRow.id,
      sku: productRow.sku,
      name: productRow.nombre,
      description: productRow.descripcion,
      unit: productRow.unidad,
      cost: productRow.costo,
      price1: p1,
      price2: p2,
      price3: p3,
      min_stock: productRow.stock_minimo,
      stock: totalStock,
      supplier: supplierObj,
      category: categoryObj,
      image_url: image_url
    } });
  } catch (err: any) {
    console.error('getProductById error', err);
    return res.status(500).json({ error: err.message || err });
  }
};

// Debug endpoint: return raw products rows for troubleshooting (TEMPORARY)
export const debugGetProducts = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    let prodQuery = supabase.from('productos').select('*');
    if (q) {
      const esc = q.replace(/%/g, '\\%');
      prodQuery = prodQuery.or(`nombre.ilike.%${esc}%,sku.ilike.%${esc}%`);
    }
    // apply simple supplier/category match if provided (Spanish column names)
    const category = req.query.categoryId as string | undefined;
    const supplier = req.query.supplierId as string | undefined;
    if (category) prodQuery = prodQuery.eq('categoria_id', category);
    if (supplier) prodQuery = prodQuery.eq('proveedor_id', supplier);

    const { data, error } = await prodQuery;
    return res.json({ query: { q, category, supplier }, data, error: error ? (error.message || error) : null });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || err });
  }
};
