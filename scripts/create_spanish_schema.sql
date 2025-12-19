-- Migration: create_spanish_schema.sql
-- Adds new Spanish-named tables (ADDITIVE migration).
-- This file MUST be run manually against the database. It does NOT drop or rename existing tables.

-- NOTE: Designed for PostgreSQL / Supabase. Adjust types if needed for other DBs.

-- Ensure pgcrypto (gen_random_uuid) is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

-- 1) usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correo text NOT NULL UNIQUE,
  nombre_completo text NOT NULL,
  rol text NOT NULL DEFAULT 'vendedor',
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- 2) clientes
CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social text NOT NULL,
  rfc text,
  telefono text,
  correo text,
  direccion text,
  contacto text,
  notas text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clientes_razon_social ON clientes (lower(razon_social));

-- 3) proveedores
CREATE TABLE IF NOT EXISTS proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  contacto text,
  telefono text,
  correo text,
  direccion text,
  notas text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- 4) categorias
CREATE TABLE IF NOT EXISTS categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- 5) almacenes
CREATE TABLE IF NOT EXISTS almacenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  codigo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- 6) productos (maestro)
CREATE TABLE IF NOT EXISTS productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  nombre text NOT NULL,
  descripcion text,
  categoria_id uuid REFERENCES categorias(id),
  proveedor_id uuid REFERENCES proveedores(id),
  unidad text DEFAULT 'pcs',
  costo numeric(12,2) NOT NULL,
  precio_1 numeric(12,2),
  precio_2 numeric(12,2),
  precio_3 numeric(12,2),
  stock_minimo integer DEFAULT 0,
  imagen_path text,
  creado_por uuid REFERENCES usuarios(id),
  actualizado_por uuid REFERENCES usuarios(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_productos_sku ON productos (lower(sku));
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos USING gin (to_tsvector('spanish', nombre || ' ' || coalesce(descripcion,'')));

-- 7) stock_productos
CREATE TABLE IF NOT EXISTS stock_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  almacen_id uuid REFERENCES almacenes(id),
  cantidad integer NOT NULL DEFAULT 0,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (producto_id, almacen_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_productos_producto ON stock_productos (producto_id);

-- 8) movimientos_inventario
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid REFERENCES productos(id),
  tipo text NOT NULL,
  cantidad integer NOT NULL,
  referencia text,
  creado_por uuid REFERENCES usuarios(id),
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_inventario (producto_id);

-- 9) cotizaciones
CREATE TABLE IF NOT EXISTS cotizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text NOT NULL UNIQUE,
  cliente_id uuid REFERENCES clientes(id),
  subtotal numeric(14,2) NOT NULL,
  iva numeric(14,2) NOT NULL,
  total numeric(14,2) NOT NULL,
  estado text NOT NULL DEFAULT 'borrador',
  creado_por uuid REFERENCES usuarios(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cotizacion_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  producto_id uuid REFERENCES productos(id),
  descripcion text,
  cantidad integer NOT NULL,
  precio_unitario numeric(12,2) NOT NULL,
  total_linea numeric(14,2) NOT NULL
);

-- 10) facturas
CREATE TABLE IF NOT EXISTS facturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text NOT NULL UNIQUE,
  cliente_id uuid REFERENCES clientes(id),
  subtotal numeric(14,2) NOT NULL,
  iva numeric(14,2) NOT NULL,
  total numeric(14,2) NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  creado_por uuid REFERENCES usuarios(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS factura_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id uuid NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  producto_id uuid REFERENCES productos(id),
  descripcion text,
  cantidad integer NOT NULL,
  precio_unitario numeric(12,2) NOT NULL,
  total_linea numeric(14,2) NOT NULL
);

-- 11) pagos
CREATE TABLE IF NOT EXISTS pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id uuid REFERENCES facturas(id),
  monto numeric(14,2) NOT NULL,
  metodo text,
  referencia text,
  creado_por uuid REFERENCES usuarios(id),
  creado_en timestamptz NOT NULL DEFAULT now()
);

COMMIT;

-- END OF MIGRATION
