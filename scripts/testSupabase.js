// scripts/testSupabase.js
// Prueba rápida de conexión a Supabase usando variables de entorno.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY en el entorno. Revisa tu .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  try {
    console.log('Conectando a Supabase...');
    // Intentamos una consulta inofensiva: listar hasta 1 fila de la tabla `products` si existe.
    const { data, error, status } = await supabase.from('products').select('id, sku, name').limit(1);
    if (error) {
      console.error('Respuesta con error desde Supabase:', error.message || error);
      // Mostrar detalle completo si existe
      console.error('Detalle error:', error);
      process.exit(1);
    }
    console.log('Consulta OK. Status:', status);
    console.log('Resultado:', data);
    process.exit(0);
  } catch (err) {
    console.error('Error al conectar a Supabase:', err.message || err);
    console.error(err);
    process.exit(1);
  }
})();
