document.addEventListener('DOMContentLoaded', () => {
    // --- CAMBIO PARA EL DESPLIEGUE ---
    // Esta variable contendrá la dirección de nuestra API.
    // Cuando despleguemos el backend, cambiaremos el valor de 'URL_DEL_BACKEND_DESPLEGADO'.
    const API_URL = window.location.hostname.includes('localhost') 
        ? 'http://localhost:3000' 
        : 'https://reporte-utilidad-backend.onrender.com'; // Dejamos esto como un marcador de posición
    // ------------------------------------

    let miGraficoDeEvolucion;

    // ---- LÓGICA DE NAVEGACIÓN ----
    const pages = document.querySelectorAll('.page-content');
    const navButtons = {
        dashboard: document.getElementById('nav-dashboard'),
        editor: document.getElementById('nav-editor')
    };

    function showPage(pageId) {
        pages.forEach(page => {
            page.style.display = page.id === `page-${pageId}` ? 'block' : 'none';
        });
        Object.values(navButtons).forEach(btn => {
            btn.style.backgroundColor = 'var(--gray-color)';
            btn.style.color = 'white';
        });
        navButtons[pageId].style.backgroundColor = 'white';
        navButtons[pageId].style.color = 'var(--primary-color)';
    }

    navButtons.dashboard.addEventListener('click', () => showPage('dashboard'));
    navButtons.editor.addEventListener('click', () => {
        resetEditorForm();
        showPage('editor');
    });
    
    // ---- LÓGICA DE CARGA DE DATOS ----
    async function cargarResumenHistorico() {
        try {
            const response = await fetch(`${API_URL}/api/reportes`);
            const result = await response.json();
            if (result.status !== 'success') return;

            const tbody = document.getElementById('resumen-historico-body');
            tbody.innerHTML = '';
            const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            
            result.data.forEach(reporte => {
                const row = document.createElement('tr');
                row.style.borderBottom = '1px solid var(--border-color)';
                const periodo = `${meses[parseInt(reporte.period.month)]} ${reporte.period.year}`;
                row.innerHTML = `
                    <td style="padding: 1rem;">${periodo}</td>
                    <td style="padding: 1rem;">${formatCurrency(reporte.summary.totalIngresos)}</td>
                    <td style="padding: 1rem;">${formatCurrency(reporte.summary.utilidadBruta)}</td>
                    <td style="padding: 1rem;">${formatCurrency(reporte.summary.utilidadNeta)}</td>
                    <td style="padding: 1rem; text-align: center; display: flex; gap: 0.5rem;">
                        <button class="btn-ver-detalle secondary-btn" data-id="${reporte._id}">Ver/Editar</button>
                        <button class="btn-eliminar secondary-btn" data-id="${reporte._id}" style="background-color: var(--negative-color);">Eliminar</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error("Error al cargar el resumen histórico:", error);
        }
    }

    async function cargarDatosDelGrafico() {
        try {
            const response = await fetch(`${API_URL}/api/chart-data`);
            const result = await response.json();
            if (result.status !== 'success') return;
            const ctx = document.getElementById('graficoEvolucion').getContext('2d');
            if (miGraficoDeEvolucion) miGraficoDeEvolucion.destroy();
            miGraficoDeEvolucion = new Chart(ctx, {
                type: 'line', data: result.data,
                options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Evolución de Ingresos y Utilidad Neta' }},
                scales: { y: { ticks: { callback: (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value) }}}}
            });
        } catch (error) { console.error("Error al cargar datos del gráfico:", error); }
    }
    
    async function cargarDetalleEnEditor(reporteId) {
        try {
            const response = await fetch(`${API_URL}/api/reportes/detalle/${reporteId}`);
            const result = await response.json();
            if (result.status !== 'success') { alert('Error: No se pudo cargar el detalle.'); return; }
            
            resetEditorForm(); 
            const data = result.data;
            document.getElementById('month-select').value = data.period.month;
            document.getElementById('year-select').value = data.period.year;
            document.getElementById('impuestosFijos').value = formatCurrency(data.impuestos || 0);

            data.sectionsData.forEach(sectionSavedData => {
                const sectionElement = document.querySelector(`#page-editor [data-section-id="${sectionSavedData.id}"]`);
                if (!sectionElement) return;
                sectionSavedData.subSections.forEach(subSectionSavedData => {
                    let targetContainer = sectionElement.querySelector(`[data-subsection-id="${subSectionSavedData.containerId}"]`);
                     if (!targetContainer) {
                        targetContainer = sectionElement.querySelector('.rows-container');
                    }
                    if (targetContainer) {
                        targetContainer.innerHTML = '';
                        subSectionSavedData.rows.forEach(rowData => {
                            const newRow = document.createElement('div');
                            newRow.classList.add('line-item');
                            const labelHTML = rowData.isEditable ? `<input type="text" class="editable-label" value="${rowData.label}">` : `<label>${rowData.label}</label>`;
                            newRow.innerHTML = `${labelHTML}<input type="text" class="input-field" data-category="${rowData.category}" value="${formatCurrency(rowData.value)}"><span class="remove-row-btn">×</span>`;
                            targetContainer.appendChild(newRow);
                            addFormattingEvents(newRow.querySelector('.input-field'));
                        });
                    }
                });
            });
            calcularResultados();
            showPage('editor');
        } catch (error) { console.error("Error al cargar detalle:", error); }
    }
    
    document.getElementById('resumen-historico-body').addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-ver-detalle')) {
            const reporteId = e.target.dataset.id;
            cargarDetalleEnEditor(reporteId);
        }
        if (e.target.classList.contains('btn-eliminar')) {
            const reporteId = e.target.dataset.id;
            if (confirm('¿Estás seguro de que deseas eliminar este reporte de forma permanente?')) {
                try {
                    const response = await fetch(`${API_URL}/api/reportes/${reporteId}`, { method: 'DELETE' });
                    const result = await response.json();
                    if (response.ok) {
                        alert(result.message);
                        cargarResumenHistorico();
                        cargarDatosDelGrafico();
                    } else {
                        throw new Error(result.message);
                    }
                } catch (error) {
                    alert('Error al eliminar el reporte.');
                    console.error('Error al eliminar:', error);
                }
            }
        }
    });

    // ---- FUNCIONES AUXILIARES COMPLETAS ----
    const formatCurrency = (v) => isNaN(v) ? '$ 0.00' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v).replace('$', '$ ');
    
    const unformatCurrency = (v) => typeof v !== 'string' ? v || 0 : parseFloat(v.replace(/[^0-9.-]+/g, "")) || 0;
    
    const addFormattingEvents = (input) => {
        input.addEventListener('blur', (e) => {
            const value = unformatCurrency(e.target.value);
            e.target.value = formatCurrency(value);
            calcularResultados();
        });
        
        input.addEventListener('focus', (e) => {
            const value = unformatCurrency(e.target.value);
            e.target.value = value === 0 ? '' : value;
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const allFields = Array.from(document.querySelectorAll('.input-field'));
                const currentIndex = allFields.indexOf(e.target);
                const nextField = allFields[currentIndex + 1];
                if (nextField) nextField.focus();
            }
        });
    };
    
    const applyColor = (element, value) => {
        if (!element) return;
        element.classList.remove('positive', 'negative');
        if (value > 0) element.classList.add('positive');
        if (value < 0) element.classList.add('negative');
    };

    function resetEditorForm() {
        document.querySelectorAll('#page-editor .rows-container, #page-editor .sub-section-rows').forEach(c => c.innerHTML = '');
        document.getElementById('impuestosFijos').value = '';
        setupDateSelectors();
        calcularResultados();
    }

    function calcularResultados() {
        try {
            const sumarCategoria = (category) => {
                let total = 0;
                document.querySelectorAll(`#page-editor .input-field[data-category="${category}"]`).forEach(input => {
                    total += unformatCurrency(input.value);
                });
                return total;
            };

            const totalIngresos = sumarCategoria('ingresos'), totalCostoServicio = sumarCategoria('costo-servicio'), totalGastosOperativos = sumarCategoria('gastos-op');
            const impuestosFijos = unformatCurrency(document.getElementById('impuestosFijos').value);
            const utilidadBruta = totalIngresos - totalCostoServicio;
            const utilidadOperativa = utilidadBruta - totalGastosOperativos;
            const utilidadNeta = utilidadOperativa - impuestosFijos;
            
            const sueldoDirector = utilidadNeta > 0 ? utilidadNeta * 0.12 : 0, sueldoPresidente = utilidadNeta > 0 ? utilidadNeta * 0.15 : 0;
            const totalSueldosDirectivos = sueldoDirector + sueldoPresidente;
            const utilidadNetaDespuesDirectivos = utilidadNeta - totalSueldosDirectivos;
            const participacionSocio1 = utilidadNetaDespuesDirectivos > 0 ? utilidadNetaDespuesDirectivos * 0.10 : 0, participacionSocio2 = utilidadNetaDespuesDirectivos > 0 ? utilidadNetaDespuesDirectivos * 0.10 : 0;
            const utilidadAntesReservaLegal = utilidadNetaDespuesDirectivos - participacionSocio1 - participacionSocio2;
            const reservaLegal = utilidadAntesReservaLegal > 0 ? utilidadAntesReservaLegal * 0.10 : 0;
            const utilidadRetenida = utilidadAntesReservaLegal - reservaLegal;

            const margenBruto = totalIngresos > 0 ? (utilidadBruta / totalIngresos) * 100 : 0, margenOperativo = totalIngresos > 0 ? (utilidadOperativa / totalIngresos) * 100 : 0, margenNeto = totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0;

            const safeSetText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
            const safeSetFormattedCurrency = (id, value, isCost = false) => { const el = document.getElementById(id); if (el) el.textContent = isCost ? `(${formatCurrency(value)})` : formatCurrency(value); };
            
            safeSetFormattedCurrency('totalIngresos', totalIngresos);
            safeSetFormattedCurrency('totalCostoServicio', totalCostoServicio, true);
            safeSetFormattedCurrency('totalGastosOperativos', totalGastosOperativos, true);
            safeSetFormattedCurrency('utilidadBruta', utilidadBruta);
            safeSetFormattedCurrency('utilidadOperativa', utilidadOperativa);
            safeSetFormattedCurrency('utilidadAntesImpuestos', utilidadOperativa);
            safeSetFormattedCurrency('utilidadNeta', utilidadNeta);
            safeSetText('margenBruto', `${margenBruto.toFixed(2)}%`);
            safeSetText('margenOperativo', `${margenOperativo.toFixed(2)}%`);
            safeSetText('margenNeto', `${margenNeto.toFixed(2)}%`);
            safeSetFormattedCurrency('sueldoDirector', sueldoDirector, true);
            safeSetFormattedCurrency('sueldoPresidente', sueldoPresidente, true);
            safeSetFormattedCurrency('totalSueldosDirectivos', totalSueldosDirectivos, true);
            safeSetFormattedCurrency('utilidadNetaDespuesDirectivos', utilidadNetaDespuesDirectivos);
            safeSetFormattedCurrency('participacionSocio1', participacionSocio1, true);
            safeSetFormattedCurrency('participacionSocio2', participacionSocio2, true);
            safeSetFormattedCurrency('reservaLegal', reservaLegal, true);
            safeSetFormattedCurrency('utilidadRetenida', utilidadRetenida);
        } catch (error) { console.error("Error en cálculos:", error); }
    }
    
    const setupDateSelectors = () => {
        const monthSelect = document.getElementById('month-select'), yearSelect = document.getElementById('year-select'), currentYear = new Date().getFullYear(), currentMonth = new Date().getMonth();
        yearSelect.innerHTML = '';
        for (let i = currentYear + 5; i >= currentYear - 5; i--) { const option = document.createElement('option'); option.value = i; option.textContent = i; yearSelect.appendChild(option); }
        monthSelect.value = currentMonth;
        yearSelect.value = currentYear;
    };
    
    document.getElementById('reporte-container').addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-row-btn')) { if (confirm('¿Eliminar esta fila?')) { e.target.closest('.line-item').remove(); calcularResultados(); } }
        if (e.target.classList.contains('add-row-btn')) {
            const category = e.target.dataset.category;
            const targetRowsContainer = e.target.closest('.add-row-container').previousElementSibling;
            if (!targetRowsContainer) return;
            const newRow = document.createElement('div');
            newRow.classList.add('line-item');
            newRow.innerHTML = `<input type="text" class="editable-label" placeholder="Nuevo Concepto..."><input type="text" class="input-field" data-category="${category}" placeholder="$ 0.00"><span class="remove-row-btn">×</span>`;
            targetRowsContainer.appendChild(newRow);
            addFormattingEvents(newRow.querySelector('.input-field'));
            newRow.querySelector('.input-field').focus();
        }
    });

    document.getElementById('save-data-btn').addEventListener('click', async () => {
        try {
            const dataToSave = {
                period: { month: document.getElementById('month-select').value, year: document.getElementById('year-select').value },
                sectionsData: [],
                impuestos: unformatCurrency(document.getElementById('impuestosFijos').value)
            };
            document.querySelectorAll('#page-editor details.section').forEach(sectionElement => {
                const sectionId = sectionElement.dataset.sectionId;
                if (!sectionId) return;
                const mainSectionData = { id: sectionId, subSections: [] };
                sectionElement.querySelectorAll('.rows-container, .sub-section-rows').forEach(container => {
                    const titleElement = container.previousElementSibling;
                    const subSection = {
                        title: titleElement && titleElement.classList.contains('subsection-title') ? titleElement.textContent : null,
                        containerId: container.dataset.subsectionId || container.id || sectionId,
                        rows: []
                    };
                    container.querySelectorAll('.line-item').forEach(row => {
                        const labelElement = row.querySelector('label') || row.querySelector('.editable-label');
                        const valueElement = row.querySelector('.input-field');
                        if (labelElement && valueElement && valueElement.value.trim() !== '' && unformatCurrency(valueElement.value) !== 0) {
                            subSection.rows.push({ label: labelElement.tagName === 'INPUT' ? labelElement.value : labelElement.textContent, value: unformatCurrency(valueElement.value), isEditable: labelElement.tagName === 'INPUT', category: valueElement.dataset.category });
                        }
                    });
                    if (subSection.rows.length > 0) mainSectionData.subSections.push(subSection);
                });
                if (mainSectionData.subSections.length > 0) dataToSave.sectionsData.push(mainSectionData);
            });

            const response = await fetch(`${API_URL}/api/reportes`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSave)
            });
            if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
            const result = await response.json();
            alert('¡Éxito! ' + result.message);
            
            cargarResumenHistorico();
            cargarDatosDelGrafico();
            showPage('dashboard');

        } catch (error) {
            console.error("Error al guardar datos:", error);
            alert("Error al guardar los datos.");
        }
    });
    
    // --- INICIALIZACIÓN ---
    showPage('dashboard');
    cargarResumenHistorico();
    cargarDatosDelGrafico();
    resetEditorForm();
    document.getElementById('reporte-container').addEventListener('input', calcularResultados);
});
