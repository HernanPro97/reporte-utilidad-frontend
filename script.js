document.addEventListener('DOMContentLoaded', () => {
    // ---- CONFIGURACIÓN ----
    const API_URL = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
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
        
        popularKpiCards(kpiData);
        popularTablaHistorica(reportes);
        dibujarGraficoEvolucion(chartData);
        dibujarGraficoGastos(kpiData ? kpiData.gastosPorSubCategoria : null);
    }
    
    function popularKpiCards(data) {
        if (!data) {
            document.getElementById('kpi-utilidad-neta').textContent = formatCurrency(0);
            document.getElementById('kpi-ingresos').textContent = formatCurrency(0);
            document.getElementById('kpi-margen-neto').textContent = `0.00%`;
            return;
        }
        document.getElementById('kpi-utilidad-neta').textContent = formatCurrency(data.utilidadNeta);
        document.getElementById('kpi-ingresos').textContent = formatCurrency(data.totalIngresos);
        document.getElementById('kpi-margen-neto').textContent = `${(data.margenNeto || 0).toFixed(2)}%`;
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
    
    // ---- GRÁFICOS ----
    function dibujarGraficoEvolucion(data) {
        const canvas = document.getElementById('graficoEvolucion');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (graficoEvolucion) graficoEvolucion.destroy();
        if (!data) return; 
        graficoEvolucion = new Chart(ctx, { type: 'line', data, options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Evolución de Ingresos y Utilidad Neta' }}, scales: { y: { ticks: { callback: (v) => formatCurrency(v, true) }}} }});
    }

    function dibujarGraficoGastos(data) {
        const canvas = document.getElementById('graficoGastos');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        if (graficoGastos) graficoGastos.destroy();
        const hasData = data && Object.values(data).some(v => v > 0);
        const chartData = {
            labels: ['Ventas y Mkt', 'Admin', 'Mantenimiento'],
            datasets: [{
                data: hasData ? [data.gastosVentaMarketing, data.gastosGeneralesAdmin, data.gastosMantenimiento] : [1, 1, 1],
                backgroundColor: hasData ? ['rgb(59, 130, 246)', 'rgb(239, 68, 68)', 'rgb(245, 158, 11)'] : '#e5e7eb',
                hoverOffset: 4,
                borderWidth: 0,
            }]
        };
        graficoGastos = new Chart(ctx, { type: 'doughnut', data: chartData, options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Composición de Gastos Operativos (Últ. Mes)' }}}});
    }

    // ---- LÓGICA DEL EDITOR ----
    async function cargarDetalleEnEditor(reporteId) {
        const data = await fetchData(`/api/reportes/detalle/${reporteId}`);
        if (!data) { alert('Error al cargar el reporte.'); return; }

        resetEditorForm(false); // No volver a crear filas por defecto
        
        document.getElementById('month-select').value = data.period.month;
        document.getElementById('year-select').value = data.period.year;
        document.getElementById('impuestosFijos').value = formatCurrency(data.impuestos || 0);

        data.sectionsData.forEach(section => {
            section.subSections.forEach(subSection => {
                const container = document.querySelector(`#page-editor [data-subsection-id="${subSection.containerId}"]`) || document.querySelector(`#page-editor [data-section-id="${section.id}"] .rows-container`);
                if (container) {
                    container.innerHTML = ''; 
                    subSection.rows.forEach(rowData => {
                        crearFila(container, rowData.category, rowData.label, rowData.value, rowData.isEditable);
                    });
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
        
        set('totalIngresos', totalIngresos);
        set('totalCostoServicio', totalCostoServicio, true);
        set('totalGastosOperativos', totalGastosOperativos, true);
        set('utilidadBruta', utilidadBruta);
        document.getElementById('porcentajeUtilidadBruta').textContent = `${porcBruta.toFixed(2)}%`;
        set('utilidadOperativa', utilidadOperativa);
        document.getElementById('porcentajeUtilidadOperativa').textContent = `${porcOperativa.toFixed(2)}%`;
        set('utilidadAntesImpuestos', utilidadOperativa);
        set('utilidadNeta', utilidadNeta);
        document.getElementById('porcentajeUtilidadNeta').textContent = `${porcNeta.toFixed(2)}%`;
        
        set('sueldoDirector', sueldoDirector, true);
        set('sueldoPresidente', sueldoPresidente, true);
        set('totalSueldosDirectivos', totalSueldosDirectivos, true);
        set('utilidadNetaDespuesDirectivos', utilidadNetaDespuesDirectivos);
        set('participacionSocio1', participacionSocio1, true);
        set('participacionSocio2', participacionSocio2, true);
        set('reservaLegal', reservaLegal, true);
        set('utilidadRetenida', utilidadRetenida);
    }

    // ---- EVENT LISTENERS ----
    document.getElementById('resumen-historico-body').addEventListener('click', e => {
        if (e.target.matches('.btn-ver-detalle')) cargarDetalleEnEditor(e.target.dataset.id);
        if (e.target.matches('.btn-eliminar')) eliminarReporte(e.target.dataset.id);
    });
    
    document.getElementById('reporte-container').addEventListener('input', e => { if (e.target.matches('.input-field')) calcularResultados(); });
    document.getElementById('reporte-container').addEventListener('click', e => {
        if (e.target.matches('.add-row-btn')) {
            const container = e.target.parentElement.previousElementSibling;
            crearFila(container, e.target.dataset.category, '', 0, true);
        }
        if (e.target.matches('.remove-row-btn')) { e.target.parentElement.remove(); calcularResultados(); }
    });

    document.getElementById('save-data-btn').addEventListener('click', async () => {
        const dataToSave = {
            period: { month: document.getElementById('month-select').value, year: document.getElementById('year-select').value },
            sectionsData: [],
            impuestos: unformatCurrency(document.getElementById('impuestosFijos').value)
        };
        document.querySelectorAll('#page-editor .section').forEach(sectionEl => {
            const section = { id: sectionEl.dataset.sectionId, subSections: [] };
            sectionEl.querySelectorAll('.rows-container').forEach(container => {
                const subSection = {
                    containerId: container.dataset.subsectionId || sectionEl.dataset.sectionId,
                    title: container.previousElementSibling?.textContent || null,
                    rows: Array.from(container.querySelectorAll('.line-item-editable')).map(row => {
                        const labelEl = row.querySelector('.editable-label');
                        return {
                            label: labelEl.tagName === 'INPUT' ? labelEl.value : labelEl.textContent,
                            value: unformatCurrency(row.querySelector('.input-field').value),
                            isEditable: labelEl.tagName === 'INPUT',
                            category: row.querySelector('.input-field').dataset.category
                        };
                    }).filter(r => r.value !== 0)
                };
                if (subSection.rows.length > 0) section.subSections.push(subSection);
            });
            if (section.subSections.length > 0) dataToSave.sectionsData.push(section);
        });
        try {
            const response = await fetch(`${API_URL}/api/reportes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSave) });
            const result = await response.json();
            alert(result.message);
            if (response.ok) { popularDashboard(); showPage('dashboard'); }
        } catch(e) { alert('Error al guardar.'); console.error(e); }
    });

    async function eliminarReporte(reporteId) {
        if (!confirm('¿Estás seguro de que deseas eliminar este reporte?')) return;
        try {
            const response = await fetch(`${API_URL}/api/reportes/${reporteId}`, { method: 'DELETE' });
            const result = await response.json();
            alert(result.message);
            if (response.ok) popularDashboard();
        } catch(error) { alert('No se pudo eliminar el reporte.'); }
    }
    
    // ---- HELPER FUNCTIONS ----
    const formatCurrency = (v, short = false) => {
        const value = Number(v) || 0;
        if (short) {
            if (Math.abs(value) >= 1000000) return `$${(value/1000000).toFixed(1)}M`;
            if (Math.abs(value) >= 1000) return `$${(value/1000).toFixed(1)}K`;
            return `$${value.toFixed(0)}`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };
    const unformatCurrency = (v) => typeof v !== 'string' ? v || 0 : parseFloat(String(v).replace(/[^0-9.-]+/g, "")) || 0;
    
    const addFormattingEvents = (input) => {
        const originalValue = input.value;
        input.value = formatCurrency(unformatCurrency(originalValue));
        input.addEventListener('focus', () => { input.value = unformatCurrency(input.value) === 0 ? '' : unformatCurrency(input.value); });
        input.addEventListener('blur', () => { input.value = formatCurrency(unformatCurrency(input.value)); });
    };
    
    const crearFila = (container, category, label, value, isEditable) => {
        const newRow = document.createElement('div');
        newRow.className = 'line-item-editable';
        const labelHtml = isEditable ? `<input type="text" class="editable-label" placeholder="Nuevo Concepto..." value="${label}">` : `<label class="editable-label font-medium text-gray-700 w-full">${label}</label>`;
        newRow.innerHTML = `${labelHtml}<input type="text" class="input-field" data-category="${category}" value="${value}"><button class="remove-row-btn">&times;</button>`;
        container.appendChild(newRow);
        addFormattingEvents(newRow.querySelector('.input-field'));
    };

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
        setupDateSelectors();
        calcularResultados();
    }
    
    const setupDateSelectors = () => {
        const monthSelect = document.getElementById('month-select'), yearSelect = document.getElementById('year-select');
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        monthSelect.innerHTML = meses.map((m, i) => `<option value="${i}">${m}</option>`).join('');
        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '';
        for (let i = currentYear + 1; i >= currentYear - 5; i--) { yearSelect.innerHTML += `<option value="${i}">${i}</option>`; }
        monthSelect.value = new Date().getMonth();
        yearSelect.value = currentYear;
    };
    
    // ---- INICIALIZACIÓN ----
    showPage('dashboard');
    popularDashboard();
    resetEditorForm();
    document.getElementById('reporte-container').addEventListener('input', calcularResultados);
});
