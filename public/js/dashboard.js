document.addEventListener('DOMContentLoaded', () => {
  // Sales chart (line)
  const salesCtx = document.getElementById('salesChart');
  if (salesCtx) {
    const ctx = salesCtx.getContext('2d');
    window.salesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Ene','Feb','Mar','Abr','May','Jun','Jul'],
        datasets: [
          { label: 'Ingresos', data: [1200,1500,1800,1600,2000,2200,2500], borderColor:'#3B82F6', backgroundColor:'rgba(59,130,246,0.08)', tension:0.3, fill:true },
          { label: 'Periodo Anterior', data: [900,1300,1600,1400,1700,1900,2100], borderColor:'#94a3b8', borderDash:[4,4], tension:0.3, fill:false }
        ]
      },
      options: { responsive:true, plugins:{legend:{position:'bottom'}} }
    });
  }

  // Products chart (donut)
  const prodCtx = document.getElementById('productsChart');
  if (prodCtx) {
    const ctx2 = prodCtx.getContext('2d');
    window.productsChart = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Tornillos','Cables','Pintura Blanca','Cables (otro)','Otros'],
        datasets: [{ data:[30,20,15,18,17], backgroundColor:['#3B82F6','#FFB703','#10B981','#F97316','#94A3B8'] }]
      },
      options:{responsive:true, plugins:{legend:{position:'right'}}}
    });
  }

  // Period tab buttons
  document.querySelectorAll('.period-tabs button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.period-tabs button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      // For demo, we just update salesChart data slightly depending on period
      const period = btn.getAttribute('data-period');
      if (window.salesChart) {
        if (period === 'weekly') {
          window.salesChart.data.labels = ['Lun','Mar','Mie','Jue','Vie','Sab','Dom'];
          window.salesChart.data.datasets[0].data = [200,180,220,240,260,300,280];
        } else if (period === 'monthly') {
          window.salesChart.data.labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul'];
          window.salesChart.data.datasets[0].data = [1200,1500,1800,1600,2000,2200,2500];
        } else {
          window.salesChart.data.labels = ['2019','2020','2021','2022','2023'];
          window.salesChart.data.datasets[0].data = [12000,15000,18000,16000,20000];
        }
        window.salesChart.update();
      }
    });
  });
});
