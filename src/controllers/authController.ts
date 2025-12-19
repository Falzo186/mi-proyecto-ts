import { Request, Response } from 'express';
import { findUser } from '../models/userModel.js';

export const showLogin = (req: Request, res: Response) => {
  res.render('login', { title: 'Punto de Venta - Comercializadora' });
};

export const loginPost = (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  const user = findUser(username);
  // Ilustrativo: la contraseña correcta en esta demo es "demo"
  if (user && password === 'demo') {
    return res.redirect(`/dashboard?user=${encodeURIComponent(user.username)}`);
  }
  return res.status(401).render('login', { title: 'Punto de Venta - Comercializadora', error: 'Credenciales inválidas (usa usuario cualquiera con contraseña "demo")' });
};

export const showDashboard = (req: Request, res: Response) => {
  const user = typeof req.query.user === 'string' ? req.query.user : 'Invitado';
  res.render('dashboard', { title: 'Panel - Comercializadora', user });
};
