function initInventory(){
  console.debug('initInventory start');
  const search = document.getElementById('globalSearch');
  const filterSupplier = document.getElementById('filterSupplier');
  const filterCategory = document.getElementById('filterCategory');
  const inventoryBody = document.getElementById('inventoryBody');
  const loadingEl = document.getElementById('loading');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const pageInfo = document.getElementById('pageInfo');
  const toggleIva = document.getElementById('toggleIva');

  let page = 1;
  let pageSize = 25;
  let totalPages = 1;
  let lastItems = [];

  console.debug('inventory init elements', {
    search: !!search,
    filterSupplier: !!filterSupplier,
    filterCategory: !!filterCategory,
    inventoryBody: !!inventoryBody,
    loadingEl: !!loadingEl,
    pageInfo: !!pageInfo
  });

  // Global error handler to surface unexpected client errors
  window.addEventListener('error', (e) => {
    console.error('Global error', e.error || e.message || e);
    if (inventoryBody) inventoryBody.innerHTML = `<tr><td colspan="10">Error en cliente: ${e && (e.error && e.error.message ? e.error.message : e.message) || String(e)}</td></tr>`;
  });

  function formatCurrency(v) {
    if (v === null || v === undefined) return '-';
    // Use Mexican pesos notation
    return `MX$${Number(v).toFixed(2)}`;
  }

  // Escape for inclusion in HTML attributes / text
  function esc(s){ if (s === undefined || s === null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // Show a small dialog with the product name greeting
  function showNameDialog(name){
    try {
      const body = document.getElementById('nameDialogBody');
      if (body) body.textContent = 'hola mi nombre es ' + (name || '');
      const modal = document.getElementById('nameDialog');
      if (modal) {
        openModal('nameDialog');
        return;
      }
    } catch (err) {
      console.error('showNameDialog error', err);
    }
    // Fallback: if modal not present or opening failed, use alert
    try { window.alert('hola mi nombre es ' + (name || '')); } catch (e) { /* ignore */ }
  }

  // Compute price breakdown (subtotal, iva, total) for a given product and price level
  function computePriceBreak(level, p) {
    const toNum = (x) => (x === undefined || x === null || x === '' || isNaN(Number(x))) ? null : Number(x);
    const subKey = `price${level}_subtotal`;
    const ivaKey = `price${level}_iva`;
    const totalKey = `price${level}_total`;
    const rawKey = `price${level}`;

    let subtotal = toNum(p[subKey]);
    let iva = toNum(p[ivaKey]);
    let total = toNum(p[totalKey]);
    const raw = toNum(p[rawKey]);

    if (subtotal != null) {
      if (iva == null) iva = Number((subtotal * 0.16).toFixed(2));
      if (total == null) total = Number((subtotal + iva).toFixed(2));
    } else if (total != null) {
      subtotal = Number((total / 1.16).toFixed(2));
      if (iva == null) iva = Number((total - subtotal).toFixed(2));
    } else if (raw != null) {
      // If only a single numeric value exists, treat it as total
      total = raw;
      subtotal = Number((total / 1.16).toFixed(2));
      iva = Number((total - subtotal).toFixed(2));
    }

    // Final guard: if still null, return nulls
    if (subtotal == null && iva == null && total == null) return { subtotal: null, iva: null, total: null };
    return { subtotal: subtotal, iva: iva, total: total };
  }

  // Render product detail UI for a product object `p` and wire the IVA checkbox
  function renderProductDetail(p) {
    if (!p) return;
    document.getElementById('detailName').textContent = p.name || '';
    document.getElementById('detailSku').textContent = p.sku || '';
    document.getElementById('detailCost').textContent = p.cost !== undefined && p.cost !== null ? `Costo: ${formatCurrency(p.cost)}` : '';
    // unit
    const unitEl = document.getElementById('detailUnit'); if (unitEl) unitEl.textContent = p.unit || '-';
    document.getElementById('detailDesc').textContent = p.description || '';
    document.getElementById('detailStock').textContent = (p.stock ?? 0);
    const supplierName = (() => {
      if (p.supplier_name) return p.supplier_name;
      if (p.supplier && typeof p.supplier === 'object' && p.supplier.name) return p.supplier.name;
      if (typeof p.supplier === 'string') return p.supplier;
      if (p.supplier_id) return p.supplier_id;
      return '-';
    })();
    document.getElementById('detailSupplier').textContent = supplierName;
    document.getElementById('detailCategory').textContent = (p.category && p.category.name) ? p.category.name : (p.category || '-');
    const img = document.getElementById('detailImage');
    if (img) {
      if (p.image_url) img.src = p.image_url; else img.src = '/images/placeholder.svg';
    }

    const fmt = (v) => (v === undefined || v === null) ? '-' : formatCurrency(v);

    // update prices based on applyIva flag
    function updatePrices(applyIva) {
      const b1 = computePriceBreak(1, p);
      const b2 = computePriceBreak(2, p);
      const b3 = computePriceBreak(3, p);

      // Price 1
      const elP1 = document.getElementById('detailP1');
      const elP1Break = document.getElementById('detailP1Break');
      elP1Break.textContent = `Sub: ${fmt(b1.subtotal)} • IVA: ${fmt(b1.iva)}`;
      elP1.textContent = applyIva ? fmt(b1.total) : fmt(b1.subtotal);

      // Price 2
      const elP2 = document.getElementById('detailP2');
      const elP2Break = document.getElementById('detailP2Break');
      elP2Break.textContent = `Sub: ${fmt(b2.subtotal)} • IVA: ${fmt(b2.iva)}`;
      elP2.textContent = applyIva ? fmt(b2.total) : fmt(b2.subtotal);

      // Price 3
      const elP3 = document.getElementById('detailP3');
      const elP3Break = document.getElementById('detailP3Break');
      elP3Break.textContent = `Sub: ${fmt(b3.subtotal)} • IVA: ${fmt(b3.iva)}`;
      elP3.textContent = applyIva ? fmt(b3.total) : fmt(b3.subtotal);

      // Update cost display to include IVA when requested
      const elCost = document.getElementById('detailCost');
      if (elCost) {
        const costNum = (p.cost === undefined || p.cost === null) ? null : Number(p.cost);
        if (costNum == null || isNaN(costNum)) {
          elCost.textContent = '';
        } else {
          const withIva = Number((costNum * 1.16).toFixed(2));
          elCost.textContent = applyIva ? `Costo: ${formatCurrency(withIva)}` : `Costo: ${formatCurrency(costNum)}`;
        }
      }
    }

    const applyCheckbox = document.getElementById('applyIva');
    if (applyCheckbox) {
      // initialize unchecked
      applyCheckbox.checked = false;
      // bind change
      applyCheckbox.onchange = () => {
        updatePrices(applyCheckbox.checked);
      };
    }

    // initial render without IVA
    updatePrices(false);
    openModal('productDetailModal');
  }

  async function fetchProducts() {
    console.debug('fetchProducts called', { page, pageSize });
    const q = encodeURIComponent((search && search.value) || '');
    const supplier = encodeURIComponent((filterSupplier && filterSupplier.value) || '');
    const category = encodeURIComponent((filterCategory && filterCategory.value) || '');

    loadingEl.style.display = '';
    inventoryBody.innerHTML = '';

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (q) params.set('q', q);
    if (supplier) params.set('supplierId', supplier);
    if (category) params.set('categoryId', category);

    try {
      const res = await fetch(`/api/products?${params.toString()}`);
      console.debug('GET /api/products status', res.status);
      const json = await res.json();
      console.debug('GET /api/products json', json);
      // show debug panel for easier troubleshooting
      const dbg = document.getElementById('debugResponse');
      if (dbg) { dbg.style.display = 'block'; dbg.textContent = JSON.stringify(json, null, 2); }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = json.data || [];
      totalPages = json.totalPages || 1;
      pageInfo.textContent = `Página ${json.page} / ${totalPages} (${json.totalItems} items)`;

      lastItems = items || [];
      try {
        if (!Array.isArray(items) || items.length === 0) {
          inventoryBody.innerHTML = '<tr><td colspan="10">No se encontraron productos.</td></tr>';
        } else {
          renderItems(items);
        }
      } catch (renderErr) {
        console.error('renderItems failed', renderErr);
        const dbg = document.getElementById('debugResponse');
        if (dbg) { dbg.style.background = 'rgba(255,0,0,0.12)'; dbg.textContent = 'render error:\n' + (renderErr && (renderErr.stack || renderErr.message || String(renderErr)) ); }
        inventoryBody.innerHTML = `<tr><td colspan="10">Error al mostrar productos: ${renderErr && renderErr.message ? renderErr.message : String(renderErr)}</td></tr>`;
      }
      // hide debug panel after render (leave visible for quick inspection)
      // setTimeout(() => { if (dbg) dbg.style.display = 'none'; }, 2000);
    } catch (err) {
      console.error('Error fetching products', err);
      const dbg = document.getElementById('debugResponse');
      if (dbg) { dbg.style.display = 'block'; dbg.textContent = String(err && (err.message || err)); }
      inventoryBody.innerHTML = `<tr><td colspan="10">Error cargando productos: ${err.message || err}</td></tr>`;
    } finally {
      loadingEl.style.display = 'none';
    }
  }

  // Render items using current toggle state (without refetch)
  function renderItems(items) {
    const showWithIva = toggleIva ? toggleIva.checked : false; // default without IVA
    const rows = (items || []).map(p => {
      const low = (p.stock || 0) < (p.min_stock || 0);

      const valFor = (levelIndex) => {
        // Prefer detailed fields returned by API
        const detailSubtotal = p[`price${levelIndex}_subtotal`];
        const detailIva = p[`price${levelIndex}_iva`];
        const detailTotal = p[`price${levelIndex}_total`];
        // If API returned objects like price1:{subtotal,iva,total}
        const detailObj = p[`price${levelIndex}`] && typeof p[`price${levelIndex}`] === 'object' ? p[`price${levelIndex}`] : null;

        if (showWithIva) {
          if (detailObj && detailObj.total !== undefined) return detailObj.total;
          if (detailTotal !== undefined) return detailTotal;
          if (p[`price${levelIndex}`] !== undefined && !isNaN(Number(p[`price${levelIndex}`]))) return Number(p[`price${levelIndex}`]);
          return detailTotal ?? p[`price${levelIndex}`];
        }

        // Without IVA: prefer subtotal fields
        if (detailObj && detailObj.subtotal !== undefined) return detailObj.subtotal;
        if (detailSubtotal !== undefined) return detailSubtotal;
        // fallback: if we only have total, divide by 1.16
        const maybeTotal = detailTotal ?? p[`price${levelIndex}`];
        if (maybeTotal !== undefined && !isNaN(Number(maybeTotal))) return Number(maybeTotal) / 1.16;
        return maybeTotal;
      };

      return `\
        <tr class="product-row ${low ? 'low-stock' : ''}">\
          <td style="display:flex;align-items:center;gap:8px">\
              <a href="#" class="product-link" data-id="${p.id}" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit">\
              <img src="${p.image_url || '/images/placeholder.svg'}" alt="" style="width:48px;height:36px;object-fit:cover;border-radius:4px;border:1px solid rgba(255,255,255,0.03)" />\
              <span class="product-name" data-id="${p.id}" data-name="${esc(p.name)}">${esc(p.name)}</span>\
            </a>\
          </td>\
          <td>${p.sku || ''}</td>\
            <td>${(p.supplier && p.supplier.id && p.supplier.name) ? `
              <a href="#" class="supplier-link" data-id="${p.supplier.id}" style="text-decoration:none;color:inherit">${p.supplier.name}</a>
            ` : 'Sin proveedor'}</td>
          <td class="num">${p.stock ?? 0}</td>\
          <td class="num">${formatCurrency(valFor(1))}</td>\
          <td class="num">${formatCurrency(p.cost)}</td>\
          <td class="actions"><button type="button" class="btn small edit-btn" data-id="${p.id}">Editar</button> <button type="button" class="btn small muted adjust-btn" data-id="${p.id}">Ajustar</button></td>\
        </tr>`;
    }).join('');
    inventoryBody.innerHTML = rows;
    // Attach click listeners specifically to product name spans to show greeting
    try {
      inventoryBody.querySelectorAll('.product-name').forEach(el => {
        el.addEventListener('click', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const id = el.getAttribute('data-id');
          const name = el.getAttribute('data-name') || el.textContent || '';
          // Visual debug: toast + console
          console.debug('product-name clicked (direct listener):', { id, name });
          showToast('Click: ' + (name || id || 'producto'), 'success', 1200);
          if (id) {
            try { await loadProductDetail(id); } catch (err) { console.error('product-name load error', err); showToast('Error cargando detalles', 'error'); }
          } else {
            try { showNameDialog(name); } catch (e) { window.alert('hola mi nombre es ' + name); }
          }
        });
      });
      console.debug('attached direct product-name listeners:', inventoryBody.querySelectorAll('.product-name').length);
    } catch (nameAttachErr) { console.error('attach product-name listeners error', nameAttachErr); }
    // Attach direct click listeners to ensure clicks always work (defensive)
    try {
      inventoryBody.querySelectorAll('.product-link').forEach(a => {
        a.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = a.getAttribute('data-id');
          if (!id) return;
          try { await loadProductDetail(id); } catch (err) { console.error('product-link handler error', err); }
        });
      });
      inventoryBody.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const prod = lastItems.find(p => String(p.id) === String(id));
          if (!prod) return;
          document.getElementById('editId').value = prod.id || '';
          document.getElementById('editName').value = prod.name || '';
          document.getElementById('editSku').value = prod.sku || '';
          document.getElementById('editCost').value = prod.cost ?? '';
          document.getElementById('editMinStock').value = prod.min_stock ?? '';
          const supplierVal = prod.supplier && typeof prod.supplier === 'object' ? (prod.supplier.name || '') : (typeof prod.supplier === 'string' ? prod.supplier : '');
          document.getElementById('editSupplier').value = supplierVal;
          openModal('editModal');
        });
      });
      inventoryBody.querySelectorAll('.adjust-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const prod = lastItems.find(p => String(p.id) === String(id));
          if (!prod) return;
          document.getElementById('adjustId').value = prod.id || '';
          document.getElementById('adjustQty').value = '';
          document.getElementById('adjustReason').value = '';
          openModal('adjustModal');
        });
      });
      inventoryBody.querySelectorAll('.supplier-link').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = a.getAttribute('data-id');
          if (id) showSupplierDetail(id);
        });
      });
    } catch (attachErr) { console.error('attach listeners error', attachErr); }
  }

  // debounce helper
  function debounce(fn, wait = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  search.addEventListener('input', debounce(() => { page = 1; fetchProducts(); }, 400));
  filterSupplier.addEventListener('change', () => { page = 1; fetchProducts(); });
  filterCategory.addEventListener('change', () => { page = 1; fetchProducts(); });

  // Toggle IVA: re-render rows without refetching
  if (toggleIva) {
    toggleIva.addEventListener('change', () => {
      // render using lastItems
      renderItems(lastItems);
    });
  }

  prevBtn.addEventListener('click', () => { if (page > 1) { page--; fetchProducts(); } });
  nextBtn.addEventListener('click', () => { if (page < totalPages) { page++; fetchProducts(); } });

  // initial load
  fetchProducts();

  // Modal helpers
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    console.debug('openModal', id, 'modal found?', !!m);
    m.setAttribute('aria-hidden', 'false');
    m.classList.add('show');
    console.debug('openModal done', id, 'aria-hidden=', m.getAttribute('aria-hidden'), 'hasShow=', m.classList.contains('show'));
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    console.debug('closeModal', id);
    m.setAttribute('aria-hidden', 'true');
    m.classList.remove('show');
    console.debug('closeModal done', id, 'aria-hidden=', m.getAttribute('aria-hidden'), 'hasShow=', m.classList.contains('show'));
  }

  // Load and show product detail by id (exposed to window for direct onclick usage)
  async function loadProductDetail(id) {
    if (!id) return;
    try {
      // close other modals
      closeModal('editModal');
      closeModal('adjustModal');
      console.debug('loadProductDetail fetching /api/products/' + id);
      showToast('Cargando producto...', 'success', 800);
      const res = await fetch(`/api/products/${encodeURIComponent(id)}`);
      console.debug('loadProductDetail response status', res.status);
      if (!res.ok) {
        const txt = await res.text().catch(()=>'');
        console.error('loadProductDetail fetch error body:', txt);
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      console.debug('loadProductDetail json', json);
      const p = json.data;
      if (!p) throw new Error('No product');
      // Use shared renderer to populate modal and wire IVA checkbox
      renderProductDetail(p);
      // debug: ensure modal element visible
      const pm = document.getElementById('productDetailModal');
      if (pm) console.debug('productDetailModal attrs after render: aria-hidden=', pm.getAttribute('aria-hidden'), 'hasShow=', pm.classList.contains('show'));
    } catch (err) {
      console.error('Error loading product detail (loadProductDetail)', err);
      showToast('Error cargando detalles del producto', 'error');
    }
  }
  // expose globally so anchors can call it directly
  window.showProductDetail = loadProductDetail;

  // Show supplier detail modal by id
  async function showSupplierDetail(id) {
    if (!id) return;
    try {
      // fetch supplier from backend
      const res = await fetch(`/api/suppliers/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const s = json.data;
      if (!s) throw new Error('No supplier');

      // Populate supplier modal fields (IDs expected in DOM)
      const nameEl = document.getElementById('supplierName');
      const contactEl = document.getElementById('supplierContact');
      const emailEl = document.getElementById('supplierEmail');
      const phoneEl = document.getElementById('supplierPhone');
      const imgEl = document.getElementById('supplierImage');

      if (nameEl) nameEl.textContent = s.name || 'Sin nombre';
      if (contactEl) contactEl.textContent = s.contact_name || s.contact || '-';
      if (emailEl) emailEl.textContent = s.email || '-';
      if (phoneEl) phoneEl.textContent = s.phone || '-';
      if (imgEl) imgEl.src = s.image_url || s.logo_url || '/images/placeholder.svg';

      openModal('supplierDetailModal');
    } catch (err) {
      console.error('Error loading supplier detail', err);
      showToast('Error cargando proveedor', 'error');
    }
  }
  window.showSupplierDetail = showSupplierDetail;

  // Close buttons
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', (e) => {
    const modal = (e.target.closest('.modal'));
    if (modal && modal.id) closeModal(modal.id);
  }));

  // Delegated click handling for edit / adjust / product link
  inventoryBody.addEventListener('click', async (ev) => {
    try {
      let el = ev.target;
      console.debug('inventory click target:', ev.target, 'nodeType', ev.target && ev.target.nodeType);
      if (el && el.nodeType !== 1) el = el.parentElement;
      if (!el) return;

      // If click happened on a product-name (or inside it), show product detail
      const productNameEl = el.closest && el.closest('.product-name');
      if (productNameEl) {
        ev.preventDefault(); ev.stopPropagation();
        const id = productNameEl.getAttribute('data-id');
        const nm = productNameEl.getAttribute('data-name') || productNameEl.textContent || '';
        console.debug('product-name delegated click:', nm, 'id=', id);
        showToast('Click: ' + (nm || id || 'producto'), 'success', 1200);
        if (id) {
          try { await loadProductDetail(id); } catch (err) { console.error('product-name load error', err); showToast('Error cargando detalles', 'error'); }
        } else {
          showNameDialog(nm);
        }
        return;
      }

      const editBtn = el.closest && el.closest('.edit-btn');
      if (editBtn) {
        closeModal('adjustModal');
        closeModal('productDetailModal');
        ev.stopPropagation();
        const id = editBtn.getAttribute('data-id');
        const prod = lastItems.find(p => String(p.id) === String(id));
        if (!prod) return;
        document.getElementById('editId').value = prod.id || '';
        document.getElementById('editName').value = prod.name || '';
        document.getElementById('editSku').value = prod.sku || '';
        document.getElementById('editCost').value = prod.cost ?? '';
        document.getElementById('editMinStock').value = prod.min_stock ?? '';
        const supplierVal = prod.supplier && typeof prod.supplier === 'object' ? (prod.supplier.name || '') : (typeof prod.supplier === 'string' ? prod.supplier : '');
        document.getElementById('editSupplier').value = supplierVal;
        openModal('editModal');
        return;
      }

      const adjustBtn = el.closest && el.closest('.adjust-btn');
      if (adjustBtn) {
        closeModal('editModal');
        closeModal('productDetailModal');
        ev.stopPropagation();
        const id = adjustBtn.getAttribute('data-id');
        const prod = lastItems.find(p => String(p.id) === String(id));
        if (!prod) return;
        document.getElementById('adjustId').value = prod.id || '';
        document.getElementById('adjustQty').value = '';
        document.getElementById('adjustReason').value = '';
        openModal('adjustModal');
        return;
      }

      const supplierLink = el.closest && el.closest('.supplier-link');
      if (supplierLink) {
        ev.preventDefault(); ev.stopPropagation();
        const id = supplierLink.getAttribute('data-id');
        if (id) showSupplierDetail(id);
        return;
      }

      const productLink = el.closest && el.closest('.product-link');
      if (productLink) {
        console.debug('productLink clicked, id=', productLink.getAttribute('data-id'));
        ev.preventDefault(); ev.stopPropagation();
        closeModal('editModal');
        closeModal('adjustModal');
        const id = productLink.getAttribute('data-id');
        if (!id) return;
        try {
          const res = await fetch(`/api/products/${encodeURIComponent(id)}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          const p = json.data;
          if (!p) throw new Error('No product');
          renderProductDetail(p);
        } catch (err) {
          console.error('Error loading product detail', err);
          showToast('Error cargando detalles del producto', 'error');
        }
        return;
      }

    } catch (err) {
      console.error('inventoryBody click handler error', err);
    }
  });

  // Temporary diagnostics: highlight and log when product links or action buttons are clicked
  document.body.addEventListener('click', (e) => {
    try {
      const el = e.target && (e.target.nodeType === 1 ? e.target : e.target.parentElement);
      if (!el) return;
      const prod = el.closest('.product-link');
      const edit = el.closest('.edit-btn');
      const adj = el.closest('.adjust-btn');
      const supp = el.closest('.supplier-link');
      if (prod || edit || adj || supp) {
        console.debug('DIAG click:', { prod: !!prod, edit: !!edit, adjust: !!adj, supplier: !!supp, target: e.target });
        // flash outline on nearest clickable element
        const targetEl = (prod && prod) || (edit && edit) || (adj && adj) || (supp && supp);
        if (targetEl && targetEl.style) {
          const prev = targetEl.style.outline;
          targetEl.style.outline = '3px solid rgba(59,130,246,0.9)';
          setTimeout(() => { targetEl.style.outline = prev; }, 600);
        }
      }
    } catch (err) { console.error('diag click error', err); }
  }, { capture: true });

  // Submit edit form
  const editForm = document.getElementById('editForm');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('editId').value;
      const payload = {
        name: document.getElementById('editName').value,
        sku: document.getElementById('editSku').value,
        cost: Number(document.getElementById('editCost').value || 0),
        min_stock: Number(document.getElementById('editMinStock').value || 0),
        supplier: document.getElementById('editSupplier').value || null
      };
      const submitBtn = editForm.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando...'; }
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(txt || `HTTP ${res.status}`);
        }
        showToast('Producto guardado', 'success');
        closeModal('editModal');
        fetchProducts();
      } catch (err) {
        console.error('Error updating product', err);
        showToast('Error al guardar: ' + (err.message || err), 'error');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar'; }
      }
    });
  }

  // Submit adjust form
  const adjustForm = document.getElementById('adjustForm');
  if (adjustForm) {
    adjustForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('adjustId').value;
      const payload = {
        qty: Number(document.getElementById('adjustQty').value || 0),
        reason: document.getElementById('adjustReason').value || ''
      };
      const submitBtn = adjustForm.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Aplicando...'; }
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(id)}/adjust`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(txt || `HTTP ${res.status}`);
        }
        showToast('Ajuste aplicado', 'success');
        closeModal('adjustModal');
        fetchProducts();
      } catch (err) {
        console.error('Error adjusting stock', err);
        showToast('Error al ajustar: ' + (err.message || err), 'error');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Aplicar'; }
      }
    });
  }

  // Toast helper
  function showToast(message, type = 'success', timeout = 4000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = `toast ${type === 'error' ? 'error' : 'success'}`;
    t.textContent = message;
    container.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity 300ms';
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 350);
    }, timeout);
  }
}
document.addEventListener('DOMContentLoaded', initInventory);
// If the script was loaded after DOMContentLoaded already fired, run init immediately
if (document.readyState !== 'loading') initInventory();
