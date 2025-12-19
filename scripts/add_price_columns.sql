-- Add price breakdown columns to productos table
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS price1_subtotal numeric(12,2),
  ADD COLUMN IF NOT EXISTS price1_iva numeric(12,2),
  ADD COLUMN IF NOT EXISTS price1_total numeric(12,2),
  ADD COLUMN IF NOT EXISTS price2_subtotal numeric(12,2),
  ADD COLUMN IF NOT EXISTS price2_iva numeric(12,2),
  ADD COLUMN IF NOT EXISTS price2_total numeric(12,2),
  ADD COLUMN IF NOT EXISTS price3_subtotal numeric(12,2),
  ADD COLUMN IF NOT EXISTS price3_iva numeric(12,2),
  ADD COLUMN IF NOT EXISTS price3_total numeric(12,2);

-- Optionally add indexes if you query by these fields often (not necessary normally):
-- CREATE INDEX IF NOT EXISTS idx_productos_price1_total ON public.productos(price1_total);

-- Verify the columns:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'productos' AND column_name LIKE 'price%';
