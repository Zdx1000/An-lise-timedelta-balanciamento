
const moduloSelect = document.getElementById('moduloSelect');
const areaSelect = document.getElementById('areaSelect');
const tabelaBody = document.querySelector('#tabelaDados tbody');
const statusEl = document.getElementById('status');
const btnAtualizar = document.getElementById('btnAtualizar');
const btnGrafico = document.getElementById('btnGrafico');
const tabelaWrapper = document.getElementById('tabelaWrapper');
const graficoWrapper = document.getElementById('graficoWrapper');
const graficoCanvas = document.getElementById('graficoCanvas');
const loadingOverlay = document.getElementById('loading');

// Cache dos dados por módulo
const cacheDados = {};
let modulosDisponiveis = [];
let moduloInicial = '';
let chartInstance = null;

async function carregarModulos() {
	showLoading(true);
	try {
		statusEl.textContent = 'Carregando módulos...';
		const resp = await fetch('/api/modulos');
		const json = await resp.json();
		modulosDisponiveis = json.modulos || [];
		moduloSelect.innerHTML = '<option value="">Todos</option>' +
			modulosDisponiveis.map(m => `<option value="${m}">${m}</option>`).join('');
		statusEl.textContent = 'Módulos carregados';
		// Seleciona o primeiro módulo se existir
		if (modulosDisponiveis.length > 0) {
			moduloSelect.value = modulosDisponiveis[0];
			moduloInicial = modulosDisponiveis[0];
		}
	} catch (e) {
		statusEl.textContent = 'Erro ao carregar módulos';
		console.error(e);
	} finally {
		showLoading(false);
	}
}

function formatTempoExcel(valorDias) {
	if (valorDias == null || isNaN(valorDias)) return '-';
	// 1 dia = 24 horas
	const horasDec = valorDias * 24;
	// hh:mm:ss
	const totalSegundos = Math.round(valorDias * 24 * 3600);
	const hh = Math.floor(totalSegundos / 3600);
	const mm = Math.floor((totalSegundos % 3600) / 60);
	const ss = totalSegundos % 60;
	// Exibe horas decimais com 4 casas e hh:mm:ss
	return `${horasDec.toFixed(4)} h<br><span class='excel'>${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}</span>`;
}

async function carregarDados() {
	showLoading(true);
	try {
		statusEl.textContent = 'Consultando dados...';
		tabelaBody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
		const modulo = moduloSelect.value;
		// Cache: se já buscou, usa cache
		let dados = cacheDados[modulo];
		if (!dados) {
			const url = modulo ? `/api/dados?modulo=${encodeURIComponent(modulo)}` : '/api/dados';
			const resp = await fetch(url);
			const json = await resp.json();
			dados = json.dados || [];
			cacheDados[modulo] = dados;
		}
		// Popular filtro de Área
		popularFiltroArea(dados);
		// Filtrar por área selecionada
		const area = areaSelect.value;
		const dadosFiltrados = area ? dados.filter(r => r['Área'] === area) : dados;
		renderTabela(dadosFiltrados);
		statusEl.textContent = `${dadosFiltrados.length} linhas`;
		// Se estiver no modo gráfico, renderizar gráfico
		if (graficoWrapper.style.display !== 'none') {
			renderGrafico(dadosFiltrados);
		}
	} catch (e) {
		statusEl.textContent = 'Erro ao carregar dados';
		tabelaBody.innerHTML = '<tr><td colspan="3">Erro</td></tr>';
		console.error(e);
	} finally {
		showLoading(false);
	}
}

function renderTabela(dados) {
	if (!dados.length) {
		tabelaBody.innerHTML = '<tr><td colspan="3">Sem resultados</td></tr>';
		return;
	}
	tabelaBody.innerHTML = dados.map(r => `
		<tr>
			<td>${r['Endereço']}</td>
			<td>${r['Área']}</td>
			<td class="num">${formatTempoExcel(r['Tempo de Execução'])}</td>
		</tr>`).join('');
}

function popularFiltroArea(dados) {
	const areas = [...new Set(dados.map(r => r['Área']).filter(Boolean))];
	areaSelect.innerHTML = '<option value="">Todas</option>' + areas.map(a => `<option value="${a}">${a}</option>`).join('');
	// Mantém seleção se possível
	if (areas.includes(areaSelect.value)) return;
	areaSelect.value = '';
}

function renderGrafico(dados) {
	if (!graficoCanvas) return;
	// X: Endereço, Y: Tempo Médio (horas decimais)
	const labels = dados.map(r => r['Endereço']);
	const valores = dados.map(r => (r['Tempo de Execução'] || 0) * 24);
	if (chartInstance) chartInstance.destroy();
	chartInstance = new Chart(graficoCanvas, {
		type: 'bar',
		data: {
			labels,
			datasets: [{
				label: 'Tempo Médio (horas)',
				data: valores,
				backgroundColor: '#1f4e79',
				borderRadius: 4,
			}]
		},
		options: {
			responsive: true,
			plugins: {
				legend: { display: false },
				title: { display: true, text: 'Tempo Médio por Endereço' }
			},
			scales: {
				x: { title: { display: true, text: 'Endereço' } },
				y: { title: { display: true, text: 'Tempo Médio (horas)' }, beginAtZero: true }
			}
		}
	});
}

function showLoading(show) {
	if (!loadingOverlay) return;
	loadingOverlay.style.display = show ? 'flex' : 'none';
}

btnAtualizar.addEventListener('click', carregarDados);
moduloSelect.addEventListener('change', carregarDados);
areaSelect.addEventListener('change', carregarDados);

btnGrafico.addEventListener('click', () => {
	const modoGrafico = graficoWrapper.style.display === 'none';
	if (modoGrafico) {
		// Alterna para gráfico
		tabelaWrapper.style.display = 'none';
		graficoWrapper.style.display = 'block';
		btnGrafico.textContent = 'Tabela';
		// Renderiza gráfico com dados filtrados
		const modulo = moduloSelect.value;
		const area = areaSelect.value;
		let dados = cacheDados[modulo] || [];
		if (area) dados = dados.filter(r => r['Área'] === area);
		renderGrafico(dados);
	} else {
		// Alterna para tabela
		graficoWrapper.style.display = 'none';
		tabelaWrapper.style.display = 'block';
		btnGrafico.textContent = 'Gráfico';
	}
});

// Inicialização: mostra loading, carrega módulos e dados filtrados
document.addEventListener('DOMContentLoaded', async () => {
	showLoading(true);
	await carregarModulos();
	await carregarDados();
	setTimeout(() => showLoading(false), 200);
});
