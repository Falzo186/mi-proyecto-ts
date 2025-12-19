import express from 'express';
import path from 'path';
import { showLogin, loginPost, showDashboard } from './controllers/authController.js';
import { showInventory } from './controllers/inventoryController.js';
import { getProducts, updateProduct, adjustStock, getProductById } from './controllers/apiProductsController.js';
import { debugGetProducts } from './controllers/apiProductsController.js';

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/', showLogin);
app.post('/login', loginPost);
app.get('/dashboard', showDashboard);
app.get('/inventory', showInventory);
app.get('/api/products', getProducts);
app.patch('/api/products/:id', updateProduct);
app.post('/api/products/:id/adjust', adjustStock);
app.get('/api/products/:id', getProductById);

// Temporary debug route (shows raw product rows and received query params)
app.get('/api/debug/products', debugGetProducts);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Servidor iniciado en http://localhost:${port}`));
