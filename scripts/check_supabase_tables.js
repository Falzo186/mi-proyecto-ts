// scripts/check_supabase_tables.js
// Comprueba la conexión a Supabase y prueba consultas en tablas en español e inglés.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY en el entorno. Revisa tu .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const tablesToCheck = [
  'productos',
  'proveedores',
  'stock_productos',
  'clientes',
  'categorias'
];

(async () => {
  console.log('Conectando a Supabase en', SUPABASE_URL);
  for (const table of tablesToCheck) {
    try {
      const { data, error, status } = await supabase.from(table).select('*').limit(3);
      if (error) {
        console.log(`Table ${table}: ERROR ->`, error.message || error);
      } else {
        console.log(`Table ${table}: OK (rows retrieved: ${Array.isArray(data) ? data.length : 0})`);
        if (Array.isArray(data) && data.length > 0) {
          console.log(' Sample row:', data[0]);
        }
      }
    } catch (e) {
      console.log(`Table ${table}: EXCEPTION ->`, e && e.message ? e.message : e);
    }
  }
  // Also try a generic RPC to check storage public URL function (optional)
  try {
    const { data: ver, error: verErr } = await supabase.rpc('version');
    if (!verErr) console.log('RPC version result:', ver);
  } catch (e) {
    // ignore if rpc not present
  }
  process.exit(0);
})();
