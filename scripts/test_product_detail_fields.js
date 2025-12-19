#!/usr/bin/env node
// Test script: fetch product by SKU (or search) and print supplier/category resolution
const BASE = process.env.BASE || 'http://localhost:3000';
const SKU = process.argv[2] || 'TR-ANCH-001';

async function main() {
  console.log('Base:', BASE);
  console.log('Searching SKU/q:', SKU);

  const listUrl = `${BASE}/api/products?q=${encodeURIComponent(SKU)}&page=1&pageSize=10`;
  const listRes = await fetch(listUrl);
  if (!listRes.ok) {
    console.error('Error fetching product list:', listRes.status);
    process.exit(1);
  }
  const listJson = await listRes.json();
  const items = listJson.data || [];
  console.log('Found items:', items.length);
  let item = items.find(it => (it.sku && it.sku.toLowerCase() === SKU.toLowerCase()) || (it.name && it.name.toLowerCase().includes(SKU.toLowerCase())));
  if (!item && items.length > 0) item = items[0];
  if (!item) {
    console.error('No product found for', SKU);
    process.exit(1);
  }

  console.log('Using product id:', item.id, 'sku:', item.sku, 'name:', item.name);
  const detailRes = await fetch(`${BASE}/api/products/${encodeURIComponent(item.id)}`);
  if (!detailRes.ok) {
    console.error('Error fetching product detail:', detailRes.status);
    const body = await detailRes.text().catch(() => '');
    console.error('Body:', body);
    process.exit(1);
  }
  const detailJson = await detailRes.json();
  const p = detailJson.data;
  console.log('\nRaw product object:\n', JSON.stringify(p, null, 2), '\n');

  function resolveSupplier(p) {
    if (!p) return null;
    if (p.supplier_name) return p.supplier_name;
    if (p.supplier && typeof p.supplier === 'object') {
      if (p.supplier.name) return p.supplier.name;
      if (p.supplier.nombre) return p.supplier.nombre;
      if (p.supplier.razon_social) return p.supplier.razon_social;
      if (p.supplier.contact_name) return p.supplier.contact_name;
    }
    if (typeof p.supplier === 'string') return p.supplier;
    if (p.supplier_id) return p.supplier_id;
    return null;
  }

  function resolveCategory(p) {
    if (!p) return null;
    if (!p.category) return null;
    if (typeof p.category === 'string') return p.category;
    if (typeof p.category === 'object') {
      return p.category.name || p.category.nombre || p.category.razon_social || p.category.label || null;
    }
    return null;
  }

  const supplierResolved = resolveSupplier(p);
  const categoryResolved = resolveCategory(p);

  console.log('Resolved supplier:', supplierResolved);
  console.log('Supplier raw type:', typeof p.supplier);
  console.log('Supplier raw keys:', p.supplier ? Object.keys(p.supplier) : 'none');
  console.log('Resolved category:', categoryResolved);
  console.log('Category raw type:', typeof p.category);
  console.log('Category raw keys:', p.category ? Object.keys(p.category) : 'none');
}

main().catch(err => { console.error(err); process.exit(1); });
