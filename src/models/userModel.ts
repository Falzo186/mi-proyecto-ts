export interface User {
  username: string;
  displayName: string;
  role: string;
}

const users: User[] = [
  { username: 'admin', displayName: 'Administrador', role: 'manager' },
  { username: 'cajero', displayName: 'Cajero Principal', role: 'cashier' }
];

export const findUser = (username?: string) => users.find(u => u.username === username);
