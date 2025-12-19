document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    // Simple UX: disable button and show working state
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Verificando...';
    }
  });
});
