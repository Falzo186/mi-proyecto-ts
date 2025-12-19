import { calcPriceLevels } from '../utils/price.js';

function printLevels(cost: number) {
  console.log(`\n--- Ejemplo: cost = ${cost} ---`);
  const levels = calcPriceLevels(cost);
  console.log('Precio 1 (30%):', levels.price1);
  console.log('Precio 2 (25%):', levels.price2);
  console.log('Precio 3 (15%):', levels.price3);
}

// Casos de ejemplo
printLevels(0);
printLevels(100);
printLevels(12.5);

// Test rápido con aserciones básicas
const t = calcPriceLevels(100);
// Precio 1 total esperado: (100*1.30)*1.16 = 150.8
console.assert(t.price1.total === 150.8, 'Precio1 esperado 150.8, obtenido ' + t.price1.total);

console.log('\nTests rápidos completados (console.assert). Si no ves errores, OK.');
