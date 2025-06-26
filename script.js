document.addEventListener('DOMContentLoaded', () => {
    // ---- CONFIGURACIÓN ----
    const API_URL = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
        ? 'http://localhost:3000'
        : 'https://reporte-utilidad-backend.onrender.com';

    let graficoEvolucion, graficoCostos;

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
            if (!response.ok) {
                console.error(`Error del servidor para ${endpoint}: ${response.status}`);
                return null;
            }
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'Error en los datos de la API');
            return result.data;
        } catch (error) {
            console.error(`Error al cargar ${endpoint}:`, error);
            return null;
        }
    }

    async function popularDashboard() {
        const reportes = await fetchData('/api/reportes');
        if (!reportes || reportes.length === 0) {
            // Manejar estado vacío
            document.getElementById('dashboard-content').classList.add('hidden');
            popularTablaHistorica([]);
            return;
        }
        document.getElementById('dashboard-content').classList.remove('hidden');
        
        setupDashboardSelectors(reportes);
        popularTablaHistorica(reportes);
        dibujarGraficoEvolucion(await fetchData('/api/chart-data'));

        // Cargar datos del mes más reciente por defecto
        const lastReport = reportes[reportes.length - 1];
        if (lastReport) {
            document.getElementById('dashboard-year-select').value = lastReport.period.year;
            document.getElementById('dashboard-month-select').value = lastReport.period.month;
            actualizarKpiYGraficoTorta(lastReport.period.year, lastReport.period.month);
        }
    }
    
    async function actualizarKpiYGraficoTorta(year, month) {
        const kpiData = await fetchData(`/api/kpi-summary/${year}/${month}`);
        if (!kpiData) {
            document.getElementById('kpi-utilidad-neta').textContent = formatCurrency(0);
            document.getElementById('kpi-ingresos').textContent = formatCurrency(0);
            document.getElementById('kpi-margen-neto').textContent = `0.00%`;
            dibujarGraficoCostos(null);
            return;
        }
        document.getElementById('kpi-utilidad-neta').textContent = formatCurrency(kpiData.utilidadNeta);
        document.getElementById('kpi-ingresos').textContent = formatCurrency(kpiData.totalIngresos);
        document.getElementById('kpi-margen-neto').textContent = `${(kpiData.margenNeto || 0).toFixed(2)}%`;
        dibujarGraficoCostos(kpiData);
    }
    
    function popularTablaHistorica(data) {
        const tbody = document.getElementById('resumen-historico-body');
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-gray-500">No hay reportes para mostrar. ¡Crea uno nuevo!</td></tr>`;
            return;
        }
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
                    <button class="btn-ver-detalle text-indigo-600 hover:text-indigo-900 font-semibold" data-id="${reporte._id}">Ver/Editar</button>
                    <button class="btn-eliminar text-red-600 hover:text-red-900 font-semibold" data-id="${reporte._id}">Eliminar</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    
    function dibujarGraficoEvolucion(data) {
        if (!document.getElementById('graficoEvolucion') || !data) return;
        const ctx = document.getElementById('graficoEvolucion').getContext('2d');
        if (graficoEvolucion) graficoEvolucion.destroy();
        graficoEvolucion = new Chart(ctx, { type: 'line', data, options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Evolución de Ingresos y Utilidad Neta' }}, scales: { y: { ticks: { callback: (v) => formatCurrency(v, true) }}} }});
    }

    function dibujarGraficoCostos(data) {
        if (!document.getElementById('graficoCostos')) return;
        const ctx = document.getElementById('graficoCostos').getContext('2d');
        if (graficoCostos) graficoCostos.destroy();
        const hasData = data && (data.totalCostoServicio > 0 || data.totalGastosOperativos > 0 || data.impuestos > 0 || data.utilidadNeta > 0);
        const chartData = {
            labels: ['Costo del Servicio', 'Gastos Operativos', 'Impuestos', 'Utilidad Neta'],
            datasets: [{
                data: hasData ? [data.totalCostoServicio, data.totalGastosOperativos, data.impuestos, data.utilidadNeta] : [1],
                backgroundColor: hasData ? ['rgb(239, 68, 68)', 'rgb(245, 158, 11)', 'rgb(234, 179, 8)','rgb(34, 197, 94)'] : '#e5e7eb',
                hoverOffset: 4, borderWidth: 0,
            }]
        };
        graficoCostos = new Chart(ctx, { type: 'doughnut', data: chartData, options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Estructura de Costos y Utilidad' }}}});
    }

    async function cargarDetalleEnEditor(reporteId) {
        const data = await fetchData(`/api/reportes/detalle/${reporteId}`);
        if (!data) { alert('Error al cargar el reporte.'); return; }
        resetEditorForm(false);
        document.getElementById('month-select').value = data.period.month;
        document.getElementById('year-select').value = data.period.year;
        document.getElementById('impuestosFijos').value = formatCurrency(data.impuestos || 0);
        data.sectionsData.forEach(section => {
            section.subSections.forEach(subSection => {
                const container = document.querySelector(`#page-editor [data-subsection-id="${subSection.containerId}"]`) || document.querySelector(`#page-editor [data-section-id="${section.id}"] .rows-container`);
                if (container) {
                    container.innerHTML = ''; 
                    subSection.rows.forEach(rowData => crearFila(container, rowData.category, rowData.label, rowData.value, rowData.isEditable));
                }
            });
        });
        calcularResultados();
        showPage('editor');
    }
    
    function calcularResultados() {
        const sumar = (cat) => Array.from(document.querySelectorAll(`#page-editor [data-category="${cat}"]`)).reduce((acc, input) => acc + unformatCurrency(input.value), 0);
        const totalIngresos = sumar('ingresos'), totalCostoServicio = sumar('costo-servicio'), totalGastosOperativos = sumar('gastos-op');
        const utilidadBruta = totalIngresos - totalCostoServicio, utilidadOperativa = utilidadBruta - totalGastosOperativos;
        const impuestos = unformatCurrency(document.getElementById('impuestosFijos').value), utilidadNeta = utilidadOperativa - impuestos;
        const sueldoDirector = utilidadNeta > 0 ? utilidadNeta * 0.12 : 0, sueldoPresidente = utilidadNeta > 0 ? utilidadNeta * 0.15 : 0;
        const totalSueldosDirectivos = sueldoDirector + sueldoPresidente, utilidadNetaDespuesDirectivos = utilidadNeta - totalSueldosDirectivos;
        const participacionSocio1 = utilidadNetaDespuesDirectivos > 0 ? utilidadNetaDespuesDirectivos * 0.10 : 0, participacionSocio2 = utilidadNetaDespuesDirectivos > 0 ? utilidadNetaDespuesDirectivos * 0.10 : 0;
        const utilidadAntesReservaLegal = utilidadNetaDespuesDirectivos - participacionSocio1 - participacionSocio2;
        const reservaLegal = utilidadAntesReservaLegal > 0 ? utilidadAntesReservaLegal * 0.10 : 0, utilidadRetenida = utilidadAntesReservaLegal - reservaLegal;
        const porcBruta = totalIngresos > 0 ? (utilidadBruta / totalIngresos) * 100 : 0, porcOperativa = totalIngresos > 0 ? (utilidadOperativa / totalIngresos) * 100 : 0, porcNeta = totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0;
        const set = (id, val, isCost=false) => { const el=document.getElementById(id); if(el) el.textContent = isCost ? `(${formatCurrency(val)})` : formatCurrency(val); };
        set('totalIngresos', totalIngresos); set('totalCostoServicio', totalCostoServicio, true); set('totalGastosOperativos', totalGastosOperativos, true);
        set('utilidadBruta', utilidadBruta); document.getElementById('porcentajeUtilidadBruta').textContent = `${porcBruta.toFixed(2)}%`;
        set('utilidadOperativa', utilidadOperativa); document.getElementById('porcentajeUtilidadOperativa').textContent = `${porcOperativa.toFixed(2)}%`;
        set('utilidadAntesImpuestos', utilidadOperativa);
        set('utilidadNeta', utilidadNeta); document.getElementById('porcentajeUtilidadNeta').textContent = `${porcNeta.toFixed(2)}%`;
        set('sueldoDirector', sueldoDirector, true); set('sueldoPresidente', sueldoPresidente, true); set('totalSueldosDirectivos', totalSueldosDirectivos, true);
        set('utilidadNetaDespuesDirectivos', utilidadNetaDespuesDirectivos);
        set('participacionSocio1', participacionSocio1, true); set('participacionSocio2', participacionSocio2, true);
        set('reservaLegal', reservaLegal, true); set('utilidadRetenida', utilidadRetenida);
    }

    document.getElementById('resumen-historico-body').addEventListener('click', e => { if (e.target.matches('.btn-ver-detalle')) cargarDetalleEnEditor(e.target.dataset.id); if (e.target.matches('.btn-eliminar')) eliminarReporte(e.target.dataset.id); });
    document.getElementById('reporte-container').addEventListener('input', e => { if (e.target.matches('.input-field')) calcularResultados(); });
    document.getElementById('reporte-container').addEventListener('click', e => { if (e.target.matches('.add-row-btn')) { const container = e.target.parentElement.previousElementSibling; crearFila(container, e.target.dataset.category, '', 0, true); } if (e.target.matches('.remove-row-btn')) { e.target.parentElement.remove(); calcularResultados(); } });
    document.getElementById('save-data-btn').addEventListener('click', async () => { /* ... (sin cambios) ... */ });
    async function eliminarReporte(reporteId) { /* ... (sin cambios) ... */ }
    
    const formatCurrency = (v, short = false) => { /* ... (sin cambios) ... */ };
    const unformatCurrency = (v) => typeof v !== 'string' ? v || 0 : parseFloat(String(v).replace(/[^0-9.-]+/g, "")) || 0;
    const addFormattingEvents = (input) => { const originalValue = input.value; input.value = formatCurrency(unformatCurrency(originalValue)); input.addEventListener('focus', () => { input.value = unformatCurrency(input.value) === 0 ? '' : unformatCurrency(input.value); }); input.addEventListener('blur', () => { input.value = formatCurrency(unformatCurrency(input.value)); }); };
    const crearFila = (container, category, label, value, isEditable) => { const newRow = document.createElement('div'); newRow.className = 'line-item-editable'; const labelHtml = isEditable ? `<input type="text" class="editable-label" placeholder="Nuevo Concepto..." value="${label}">` : `<label class="editable-label font-medium text-gray-700 w-full">${label}</label>`; newRow.innerHTML = `${labelHtml}<input type="text" class="input-field" data-category="${category}" value="${value}"><button class="remove-row-btn">&times;</button>`; container.appendChild(newRow); addFormattingEvents(newRow.querySelector('.input-field')); };
    
    function resetEditorForm(crearFilasPorDefecto = true) {
        document.querySelectorAll('#page-editor .rows-container').forEach(c => c.innerHTML = '');
        document.getElementById('impuestosFijos').value = formatCurrency(0);
        if (crearFilasPorDefecto) {
            const defaultSections = {
                ingresos: { cat: 'ingresos', labels: ['Encuestas', 'Claro Solvencia', 'WOM', 'Mexico', 'Tuves', 'Citas España', 'Bells'] },
                costoServicio: { cat: 'costo-servicio', labels: ['Sueldo Encuestas', 'Sueldo Claro Solvencia', 'Sueldo WOM', 'Sueldo Mexico', 'Sueldo Citas España', 'Sueldo Tuves', 'Sueldo Bells', 'Transferencia'] },
                gastosVentaMarketing: { cat: 'gastos-op', labels: ['Anuncios', 'Publicidad', 'LinkedIn'] },
                gastosGeneralesAdmin: { cat: 'gastos-op', labels: ['Sueldo Tecnología', 'Sueldo RRHH', 'Sueldo Contadora', 'Sueldo Administración', 'Sueldo Recepción', 'Sueldo Limpieza', 'Renta de Oficina', 'Internet', 'Dominios', 'Transporte'] },
                gastosMantenimiento: { cat: 'gastos-op', labels: ['Mantenimiento (Estructura, A/C)', 'Fumigación', 'Switch', 'Artículos de Limpieza', 'Baterías', 'Bolsas de Basura'] }
            };
            for (const key in defaultSections) {
                const container = document.querySelector(`[data-subsection-id="${key}"]`) || document.querySelector(`[data-section-id="${key}"] .rows-container`);
                if (container) {
                    const { cat, labels } = defaultSections[key];
                    labels.forEach(label => crearFila(container, cat, label, 0, false));
                }
            }
        }
        setupDateSelectors('month-select', 'year-select');
        calcularResultados();
    }
    
    const setupDateSelectors = (monthId, yearId, reportes = null) => {
        const monthSelect = document.getElementById(monthId), yearSelect = document.getElementById(yearId);
        if (!monthSelect || !yearSelect) return;
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        monthSelect.innerHTML = meses.map((m, i) => `<option value="${i}">${m}</option>`).join('');

        const years = reportes ? [...new Set(reportes.map(r => r.period.year))].sort((a,b) => b-a) : [new Date().getFullYear()];
        yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    };

    const setupDashboardSelectors = (reportes) => {
        setupDateSelectors('dashboard-month-select', 'dashboard-year-select', reportes);
        document.getElementById('dashboard-month-select').addEventListener('change', handleDashboardPeriodChange);
        document.getElementById('dashboard-year-select').addEventListener('change', handleDashboardPeriodChange);
    };

    const handleDashboardPeriodChange = () => {
        const year = document.getElementById('dashboard-year-select').value;
        const month = document.getElementById('dashboard-month-select').value;
        actualizarKpiYGraficoTorta(year, month);
    };
    
    // ---- INICIALIZACIÓN ----
    showPage('dashboard');
    popularDashboard();
    resetEditorForm();
    document.getElementById('reporte-container').addEventListener('input', calcularResultados);
});

