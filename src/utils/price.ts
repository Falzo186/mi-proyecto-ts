export interface PriceLevel {
  subtotal: number; // costo + utilidad (sin IVA)
  iva: number;      // IVA sobre el subtotal
  total: number;    // subtotal + iva
}

export interface PriceLevels {
  price1: PriceLevel;
  price2: PriceLevel;
  price3: PriceLevel;
}

/**
 * Calcula tres niveles de precio basados en el costo (sin IVA) aplicando utilidades
 * y luego agregando IVA.
 *
 * Fórmula: PrecioVenta = (Costo * (1 + Utilidad)) * (1 + IVA)
 * Utilidades por nivel: price1=25%, price2=30%, price3=35%
 * IVA por defecto: 16% (0.16)
 *
 * @param cost Costo unitario de compra (sin IVA). Debe ser >= 0.
 * @param iva Porcentaje de IVA en forma decimal (ej. 0.16). Opcional (default 0.16).
 * @returns objeto con price1, price2 y price3. Cada nivel incluye subtotal, iva y total.
 */
export function calcPriceLevels(cost: number, iva = 0.16): PriceLevels {
  // aqui calcula los precios
  if (typeof cost !== 'number' || isNaN(cost) || cost < 0) {
    throw new Error('Costo inválido: debe ser un número mayor o igual a 0');
  }

  const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

  const calc = (util: number): PriceLevel => {
    const subtotal = cost * (1 + util);
    const ivaAmt = subtotal * iva;
    const total = subtotal + ivaAmt;
    return { subtotal: round2(subtotal), iva: round2(ivaAmt), total: round2(total) };
  };

  return {
    price1: calc(0.25),
    price2: calc(0.30),
    price3: calc(0.35),
  };
}

// exportar también una versión por defecto para JS interop
export default calcPriceLevels;
