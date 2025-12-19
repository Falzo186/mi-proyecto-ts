import { Request, Response } from 'express';
import { calcPriceLevels } from '../utils/price.js';

function fmtCurrency(v: number) {
  return `$${v.toFixed(2)} USD`;
}

export const showInventory = (req: Request, res: Response) => {
  // Mock data — en una implementación real vendría de la BD
  const products = [
    {
      name: 'Tornillos de Anclaje',
      sku: 'TR-ANCH-001',
      supplier: 'Ferretería Central',
      stock: 25,
      minStock: 50,
      cost: 10.0,
    },
    {
      name: 'Guantes de Seguridad',
      sku: 'GU-SAFE-002',
      supplier: 'Seguridad Plus',
      stock: 120,
      minStock: 30,
      cost: 2.5,
    },
    {
      name: 'Pintura Blanca 4L',
      sku: 'PT-WHT-004',
      supplier: 'Pinturas del Norte',
      stock: 12,
      minStock: 10,
      cost: 18.0,
    }
  ];

  // Pre-calc prices and format values
  const rows = products.map(p => {
    const levels = calcPriceLevels(p.cost);
    return {
      ...p,
      price1: fmtCurrency(levels.price1.total),
      price2: fmtCurrency(levels.price2.total),
      price3: fmtCurrency(levels.price3.total),
      costFmt: fmtCurrency(p.cost)
    };
  });

  res.render('inventory', { title: 'Inventario - Comercializadora Murillo', active: 'inventory', products: rows });
};
