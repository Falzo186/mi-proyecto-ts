#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY en .env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const id = process.argv[2];
if (!id) {
  console.error('Uso: node scripts/get_proveedor.js <proveedor-id>');
  process.exit(1);
}

(async () => {
  try {
    const { data, error } = await supabase.from('proveedores').select('*').eq('id', id).limit(1).single();
    if (error) {
      console.error('Error fetching proveedor:', error.message || error);
      process.exit(1);
    }
    console.log('Proveedor row:');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Exception:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
