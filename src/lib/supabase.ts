import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar variables de entorno en desarrollo desde .env
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Faltan variables de entorno SUPABASE_URL o SUPABASE_ANON_KEY. Comprueba tu .env');
}

/**
 * Cliente Supabase inicializado.
 * Importa `supabase` desde `src/lib/supabase` para usarlo en controladores y servicios.
 *
 * Nota de seguridad: No uses la Anon Key para operaciones que requieran privilegios de administrador
 * (usa la Service Role Key en funciones seguras del servidor). Protege las claves en variables de entorno
 * y no las incluyas en repositorios públicos.
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // No persistir sesión en el servidor por defecto
    persistSession: false
  }
});

export default supabase;
