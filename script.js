document.addEventListener('DOMContentLoaded', () => {
    const API_URL = window.location.hostname.includes('localhost') 
        ? 'http://localhost:3000' 
        : 'https://reporte-utilidad-backend.onrender.com';

    let graficoEvolucion, graficoGastos;

    // ---- NAVEGACIÓN ----
    const pages = {
        dashboard: document.getElementById('page-dashboard'),
        editor: document.getElementById('page-editor'),
    };
    const navButtons = {
        dashboard: document.getElementById('nav-dashboard'),
        editor: document.getElementById('nav-editor'),
    };

    function showPage(pageId) {
        Object.values(pages).forEach(p => p.classList.add('hidden'));
        pages[pageId].classList.remove('hidden');
        Object.entries(navButtons).forEach(([id, btn]) => {
            btn.classList.toggle('bg-blue-600', id === pageId);
            btn.classList.toggle('text-white', id === pageId);
            btn.classList.toggle('text-gray-500', id !== pageId);
            btn.classList.toggle('hover:bg-gray-200', id !== pageId);
        });
    }

    navButtons.dashboard.addEventListener('click', () => showPage('dashboard'));
    navButtons.editor.addEventListener('click', () => {
        resetEditorForm();
        showPage('editor');
    });

    // ---- LÓGICA DE CARGA DE DATOS ----
    async function fetchData(endpoint) {
        try {
            const response = await fetch(`${API_URL}${endpoint}`);
            if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'Error en los datos de la API');
            return result.data;
        } catch (error) {
            console.error(`Error al cargar ${endpoint}:`, error);
            return null;
        }
    }

    async function popularDashboard() {
        const [kpiData, reportes, chartData] = await Promise.all([
            fetchData('/api/kpi-summary'),
            fetchData('/api/reportes'),
            fetchData('/api/chart-data')
        ]);

        if (kpiData) popularKpiCards(kpiData);
        if (reportes) popularTablaHistorica(reportes);
        if (chartData) dibujarGraficoEvolucion(chartData);
    }
    
    function popularKpiCards(data) {
        document.getElementById('kpi-utilidad-neta').textContent = formatCurrency(data.utilidadNeta);
        document.getElementById('kpi-ingresos').textContent = formatCurrency(data.totalIngresos);
        document.getElementById('kpi-margen-neto').textContent = `${data.margenNeto.toFixed(2)}%`;
        dibujarGraficoGastos(data.gastosPorSubCategoria);
    }

    function popularTablaHistorica(data) {
        const tbody = document.getElementById('resumen-historico-body');
        tbody.innerHTML = '';
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        data.forEach(reporte => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 transition-all';
            const periodo = `${meses[parseInt(reporte.period.month)]} ${reporte.period.year}`;
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${periodo}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatCurrency(reporte.summary.totalIngresos)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatCurrency(reporte.summary.utilidadBruta)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatCurrency(reporte.summary.utilidadNeta)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                    <button class="btn-ver-detalle text-indigo-600 hover:text-indigo-900" data-id="${reporte._id}">Ver/Editar</button>
                    <button class="btn-eliminar text-red-600 hover:text-red-900" data-id="${reporte._id}">Eliminar</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    
    // ---- GRÁFICOS ----
    function dibujarGraficoEvolucion(data) {
        const ctx = document.getElementById('graficoEvolucion').getContext('2d');
        if (graficoEvolucion) graficoEvolucion.destroy();
        graficoEvolucion = new Chart(ctx, { type: 'line', data, options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Evolución de Ingresos y Utilidad Neta' }}, scales: { y: { ticks: { callback: (v) => formatCurrency(v, true) }}} }});
    }

    function dibujarGraficoGastos(data) {
        const ctx = document.getElementById('graficoGastos').getContext('2d');
        if (graficoGastos) graficoGastos.destroy();
        const chartData = {
            labels: ['Ventas y Mkt', 'Admin', 'Mantenimiento'],
            datasets: [{
                data: [data.gastosVentaMarketing, data.gastosGeneralesAdmin, data.gastosMantenimiento],
                backgroundColor: ['rgb(59, 130, 246)', 'rgb(239, 68, 68)', 'rgb(245, 158, 11)'],
                hoverOffset: 4
            }]
        };
        graficoGastos = new Chart(ctx, { type: 'doughnut', data: chartData, options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Composición de Gastos Operativos' }}}});
    }

    // ---- LÓGICA DEL EDITOR ----
    function resetEditorForm() {
        // ... (Tu lógica de reset aquí, si la necesitas, pero cargar detalle ya limpia)
    }

    async function cargarDetalleEnEditor(reporteId) {
        const data = await fetchData(`/api/reportes/detalle/${reporteId}`);
        if (!data) { alert('Error al cargar el reporte.'); return; }

        document.querySelectorAll('#page-editor .rows-container').forEach(c => c.innerHTML = '');
        
        document.getElementById('month-select').value = data.period.month;
        document.getElementById('year-select').value = data.period.year;
        document.getElementById('impuestosFijos').value = formatCurrency(data.impuestos || 0);

        data.sectionsData.forEach(section => {
            section.subSections.forEach(subSection => {
                const container = document.querySelector(`#page-editor [data-subsection-id="${subSection.containerId}"]`) || document.querySelector(`#page-editor [data-section-id="${section.id}"] .rows-container`);
                if (container) {
                    subSection.rows.forEach(rowData => {
                        const newRow = document.createElement('div');
                        newRow.className = 'line-item-editable';
                        newRow.innerHTML = `<input type="text" class="editable-label" value="${rowData.label}"><input type="text" class="input-field" data-category="${rowData.category}" value="${formatCurrency(rowData.value)}"><button class="remove-row-btn">&times;</button>`;
                        container.appendChild(newRow);
                    });
                }
            });
        });
        
        calcularResultados();
        showPage('editor');
    }
    
    function calcularResultados() {
        // ... Lógica de cálculo actualizada ...
        const sumar = (cat) => Array.from(document.querySelectorAll(`#page-editor [data-category="${cat}"]`)).reduce((acc, input) => acc + unformatCurrency(input.value), 0);
        
        const totalIngresos = sumar('ingresos');
        const totalCostoServicio = sumar('costo-servicio');
        const totalGastosOperativos = sumar('gastos-op');

        const utilidadBruta = totalIngresos - totalCostoServicio;
        const utilidadOperativa = utilidadBruta - totalGastosOperativos;
        const impuestos = unformatCurrency(document.getElementById('impuestosFijos').value);
        const utilidadNeta = utilidadOperativa - impuestos;
        
        // Calcular porcentajes
        const porcBruta = totalIngresos > 0 ? (utilidadBruta / totalIngresos) * 100 : 0;
        const porcOperativa = totalIngresos > 0 ? (utilidadOperativa / totalIngresos) * 100 : 0;
        const porcNeta = totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0;

        // Mostrar resultados
        document.getElementById('totalIngresos').textContent = formatCurrency(totalIngresos);
        document.getElementById('totalCostoServicio').textContent = `(${formatCurrency(totalCostoServicio)})`;
        document.getElementById('totalGastosOperativos').textContent = `(${formatCurrency(totalGastosOperativos)})`;

        document.getElementById('utilidadBruta').textContent = formatCurrency(utilidadBruta);
        document.getElementById('porcentajeUtilidadBruta').textContent = `${porcBruta.toFixed(2)}%`;
        
        document.getElementById('utilidadOperativa').textContent = formatCurrency(utilidadOperativa);
        document.getElementById('porcentajeUtilidadOperativa').textContent = `${porcOperativa.toFixed(2)}%`;
        
        document.getElementById('utilidadAntesImpuestos').textContent = formatCurrency(utilidadOperativa);
        
        document.getElementById('utilidadNeta').textContent = formatCurrency(utilidadNeta);
        document.getElementById('porcentajeUtilidadNeta').textContent = `${porcNeta.toFixed(2)}%`;
    }

    // ---- EVENT LISTENERS ----
    document.getElementById('resumen-historico-body').addEventListener('click', e => {
        if (e.target.matches('.btn-ver-detalle')) cargarDetalleEnEditor(e.target.dataset.id);
        if (e.target.matches('.btn-eliminar')) eliminarReporte(e.target.dataset.id);
    });
    
    document.getElementById('reporte-container').addEventListener('input', e => {
        if (e.target.matches('.input-field')) calcularResultados();
    });

    async function eliminarReporte(reporteId) {
        if (!confirm('¿Estás seguro de que deseas eliminar este reporte?')) return;
        try {
            const response = await fetch(`${API_URL}/api/reportes/${reporteId}`, { method: 'DELETE' });
            const result = await response.json();
            alert(result.message);
            if (response.ok) popularDashboard();
        } catch(error) {
            console.error('Error al eliminar:', error);
            alert('No se pudo eliminar el reporte.');
        }
    }
    
    // ... (Otros listeners como guardar, agregar fila, etc.)

    // ---- INICIALIZACIÓN ----
    showPage('dashboard');
    popularDashboard();
    setupDateSelectors();
    calcularResultados();
});

// Helper functions
const formatCurrency = (v, short = false) => {
    if (short) { // Formato corto para gráficos
        if (Math.abs(v) >= 1_000_000) return `$${(v/1_000_000).toFixed(1)}M`;
        if (Math.abs(v) >= 1_000) return `$${(v/1_000).toFixed(1)}K`;
        return `$${v.toFixed(0)}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
};
const unformatCurrency = (v) => typeof v !== 'string' ? v || 0 : parseFloat(v.replace(/[^0-9.-]+/g, "")) || 0;
const setupDateSelectors = () => {
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    monthSelect.innerHTML = meses.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '';
    for (let i = currentYear + 1; i >= currentYear - 5; i--) {
        yearSelect.innerHTML += `<option value="${i}">${i}</option>`;
    }
    monthSelect.value = new Date().getMonth();
    yearSelect.value = currentYear;
};
