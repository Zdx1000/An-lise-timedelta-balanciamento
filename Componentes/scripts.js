
const moduloSelect = document.getElementById('moduloSelect');
const areaSelect = document.getElementById('areaSelect');
const tabelaBody = document.querySelector('#tabelaDados tbody');
const statusEl = document.getElementById('status');
const btnGrafico = document.getElementById('btnGrafico');
const tabelaWrapper = document.getElementById('tabelaWrapper');
const graficoWrapper = document.getElementById('graficoWrapper');
const graficoContainer = document.getElementById('graficoContainer');
const loadingOverlay = document.getElementById('loading');
// Elementos de paginação
const pgInfo = document.getElementById('paginacaoInfo');
const pgSelect = document.getElementById('pgSelect');
const pgPrimeira = document.getElementById('pgPrimeira');
const pgAnterior = document.getElementById('pgAnterior');
const pgProxima = document.getElementById('pgProxima');
const pgUltima = document.getElementById('pgUltima');
const pgTamanho = document.getElementById('pgTamanho');

// Cache dos dados por módulo
const cacheDados = {};
let modulosDisponiveis = [];
let moduloInicial = '';
let chartInstance = null; // Instância ApexCharts
let isBoot = true; // Flag para controlar fase inicial de boot
// Estado de paginação
let dadosFiltradosAtuais = [];
let paginaAtual = 1;
let tamanhoPagina = parseInt(pgTamanho?.value, 10) || 25;

function resetPaginacao() { paginaAtual = 1; }
function aplicarTamanhoPagina() {
	const val = parseInt(pgTamanho?.value, 10);
	if (!isNaN(val) && val > 0) tamanhoPagina = val;
}
function calcularTotalPaginas() { return Math.max(1, Math.ceil(dadosFiltradosAtuais.length / tamanhoPagina)); }
function obterSlicePagina() {
	const ini = (paginaAtual - 1) * tamanhoPagina;
	return dadosFiltradosAtuais.slice(ini, ini + tamanhoPagina);
}
function atualizarControlesPaginacao() {
	if (!pgSelect) return;
	aplicarTamanhoPagina();
	const total = calcularTotalPaginas();
	if (paginaAtual > total) paginaAtual = total;
	const LIMITE = 500; // segurança
	const paginasRender = Math.min(total, LIMITE);
	let options = '';
	for (let i = 1; i <= paginasRender; i++) options += `<option value="${i}" ${i===paginaAtual?'selected':''}>${i}</option>`;
	pgSelect.innerHTML = options;
	pgSelect.disabled = total <= 1;
	const desativar = total <= 1;
	if (pgPrimeira) pgPrimeira.disabled = desativar || paginaAtual === 1;
	if (pgAnterior) pgAnterior.disabled = desativar || paginaAtual === 1;
	if (pgProxima) pgProxima.disabled = desativar || paginaAtual === total;
	if (pgUltima) pgUltima.disabled = desativar || paginaAtual === total;
	if (pgInfo) {
		const ini = dadosFiltradosAtuais.length ? ( (paginaAtual - 1) * tamanhoPagina + 1 ) : 0;
		const fim = Math.min(paginaAtual * tamanhoPagina, dadosFiltradosAtuais.length);
		pgInfo.textContent = `${ini}-${fim} de ${dadosFiltradosAtuais.length} (Página ${paginaAtual}/${total})`;
	}
	if (statusEl && dadosFiltradosAtuais.length) statusEl.textContent = `${dadosFiltradosAtuais.length} linhas (Pág ${paginaAtual}/${total})`;
}
function irParaPagina(p) { paginaAtual = p; atualizarControlesPaginacao(); renderTabela(dadosFiltradosAtuais, true); }

function normalizarArea(valor) {
	if (valor === null || valor === undefined) return '';
	// Alguns retornos podem ser números; garantir string
	try {
		return String(valor).trim();
	} catch {
		return '';
	}
}

function calcularAlturaGrafico() {
	// 95% da altura da viewport menos alguma margem para header/footer
	const vh = window.innerHeight || document.documentElement.clientHeight;
	// Reserva ~80px para header + filtros + footer
	const altura = Math.max((vh * 0.90) - 80, 300); // mínimo 300px
	return Math.round(altura);
}

async function carregarModulos() {
	if (!isBoot) showLoading(true);
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

let ultimoUpdate = null; // Date
let agendador = null;
const INTERVALO_MS = 60_000; // 1 minuto (ajustável)

async function carregarDados() {
	if (!isBoot) showLoading(true);
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
			dados = (json.dados || []).map(r => ({ ...r, 'Área': normalizarArea(r['Área']) }));
			cacheDados[modulo] = dados;
		}
		// Popular filtro de Área
		popularFiltroArea(dados);
		// Filtrar por área selecionada
		const area = normalizarArea(areaSelect.value);
		const dadosFiltrados = area ? dados.filter(r => normalizarArea(r['Área']).toLowerCase() === area.toLowerCase()) : dados;
		resetPaginacao();
		renderTabela(dadosFiltrados);
		ultimoUpdate = new Date();
		atualizarTimestampStatus();
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

function renderTabela(dados, mantendoPagina=false) {
    // Atualiza estado principal somente quando não é re-render de navegação
    if (!mantendoPagina) dadosFiltradosAtuais = dados;
    if (!dadosFiltradosAtuais.length) {
        tabelaBody.innerHTML = '<tr><td colspan="3">Sem resultados</td></tr>';
        atualizarControlesPaginacao();
        return;
    }
    aplicarTamanhoPagina();
    const total = calcularTotalPaginas();
    if (paginaAtual > total) paginaAtual = total;
    const slice = obterSlicePagina();
    tabelaBody.innerHTML = slice.map(r => `
        <tr>
            <td>${r['Endereço']}</td>
            <td>${r['Área']}</td>
            <td class="num">${formatTempoExcel(r['Tempo de Execução'])}</td>
        </tr>`).join('');
    atualizarControlesPaginacao();
}

function popularFiltroArea(dados) {
	const areas = [...new Set(dados
		.map(r => normalizarArea(r['Área']))
		.filter(v => v))]
		.sort((a,b) => a.localeCompare(b, 'pt-BR'));
	const selAnterior = normalizarArea(areaSelect.value);
	areaSelect.innerHTML = '<option value="">Todas</option>' + areas.map(a => `<option value="${a}">${a}</option>`).join('');
	if (selAnterior && areas.map(a=>a.toLowerCase()).includes(selAnterior.toLowerCase())) {
		const match = areas.find(a => a.toLowerCase() === selAnterior.toLowerCase());
		areaSelect.value = match;
	} else {
		areaSelect.value = '';
	}
}

function renderGrafico(dados) {
	if (!graficoContainer) return;
	// Preparar pares endereço/valor (horas decimais) preservando ordem original
	const paresOriginais = dados.map(r => ({ endereco: r['Endereço'], valor: (r['Tempo de Execução'] || 0) * 24 }));
	// Cópia para classificação apenas para achar top/bottom
	const ordenadosAsc = [...paresOriginais].sort((a,b) => a.valor - b.valor);
	const bottom3 = ordenadosAsc.slice(0, 3);
	const top3 = ordenadosAsc.slice(-3);
	const categorias = paresOriginais.map(p => p.endereco);
	const valores = paresOriginais.map(p => p.valor);

	// Ranking (maiores primeiro) para exibir no tooltip
	const rankingDesc = [...paresOriginais]
		.map((p, i) => ({ ...p }))
		.sort((a,b) => b.valor - a.valor);
	const rankMap = new Map();
	rankingDesc.forEach((p, idx) => rankMap.set(p.endereco, idx + 1));

	if (chartInstance) {
		chartInstance.destroy();
		chartInstance = null;
	}

	const alturaDinamica = calcularAlturaGrafico();
	// Ajusta altura do container também (ApexCharts usa height tanto no options quanto no elemento)
	graficoContainer.style.height = alturaDinamica + 'px';

	// Mapear índices dos pontos para markers customizados
	const indiceBottom = new Set(bottom3.map(p => categorias.indexOf(p.endereco)));
	const indiceTop = new Set(top3.map(p => categorias.indexOf(p.endereco)));

	// Função para formatar label coordenada
	function fmtCoord(p) {
		const dias = (p.valor / 24) / 24; // p.valor já está em horas -> converte para dias dividindo por 24 novamente
		const totalSegundos = Math.round((p.valor / 24) * 3600); // p.valor horas -> segundos
		const hh = Math.floor(totalSegundos / 3600);
		const mm = Math.floor((totalSegundos % 3600) / 60);
		const ss = totalSegundos % 60;
		return `${p.endereco}\n${p.valor.toFixed(4)} h (${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')})`;
	}

	// Construir anotações de cruz (linhas horizontais e verticais) para top e bottom
	const crossAnnotationsY = [];
	const crossAnnotationsX = [];
	const vistosY = new Set();
	[...bottom3, ...top3].forEach(p => {
		const idx = categorias.indexOf(p.endereco);
		if (idx === -1) return;
		// Linha vertical no x (categoria) inteira
		crossAnnotationsX.push({
			x: p.endereco,
			strokeDashArray: 4,
			borderColor: indiceTop.has(idx) ? '#c62828' : '#2e7d32'
		});
		// Linha horizontal no valor y (evitar duplicadas)
		if (!vistosY.has(p.valor)) {
			vistosY.add(p.valor);
			crossAnnotationsY.push({
				y: p.valor,
				strokeDashArray: 4,
				borderColor: indiceTop.has(idx) ? '#c62828' : '#2e7d32'
			});
		}
	});

	const options = {
		chart: {
			type: 'line',
			height: alturaDinamica,
			toolbar: { show: true },
			animations: { enabled: true }
		},
		grid: {
			show: true,
			borderColor: '#e5e9ec',
			strokeDashArray: 5,
			position: 'back',
			xaxis: { lines: { show: false } },
			yaxis: { lines: { show: true } },
			row: { colors: undefined, opacity: 0 },
			column: { colors: undefined, opacity: 0 },
			padding: { top: 6, right: 10, bottom: 4, left: 8 }
		},
		stroke: {
			curve: 'smooth',
			width: 3
		},
		series: [{
			name: 'Tempo Médio (horas)',
			data: valores
		}],
		xaxis: {
			categories: categorias,
			title: { text: 'Endereço' },
			tooltip: { enabled: false },
			labels: {
				rotate: -35,
				hideOverlappingLabels: true,
				trim: true,
				style: { fontSize: categorias.length > 40 ? '9px' : (categorias.length > 25 ? '10px' : '11px') },
				formatter: (val, idx) => {
					if (!val) return '';
					// Se o identificador tiver '-', quebrar em até 2 partes
					const partes = val.split('-');
					if (partes.length === 3) {
						return partes[0] + '-' + partes[1] + '\n' + partes[2];
					}
					if (val.length > 14) return val.slice(0, 12) + '…';
					return val;
				}
			}
		},
		yaxis: {
			title: { text: 'Tempo Médio (horas)' },
			decimalsInFloat: 2,
			forceNiceScale: true
		},
		dataLabels: { enabled: false },
		markers: {
			size: 4,
			discrete: [
				// Bottom 3 em verde
				...Array.from(indiceBottom).map(i => ({ seriesIndex: 0, dataPointIndex: i, fillColor: '#2e7d32', strokeColor: '#1b5e20', size: 6 })),
				// Top 3 em vermelho
				...Array.from(indiceTop).map(i => ({ seriesIndex: 0, dataPointIndex: i, fillColor: '#c62828', strokeColor: '#8e0000', size: 7 }))
			]
		},
		annotations: {
			xaxis: crossAnnotationsX,
			yaxis: crossAnnotationsY
		},
		tooltip: {
			shared: false,
			custom: ({ series, seriesIndex, dataPointIndex, w }) => {
				const endereco = categorias[dataPointIndex];
				const val = series[seriesIndex][dataPointIndex];
				if (val == null || isNaN(val)) return '<div class="apx-tooltip"><span>Sem dado</span></div>';
				const totalSegundos = Math.round((val) * 3600); // val horas -> segundos
				const hh = Math.floor(totalSegundos / 3600);
				const mm = Math.floor((totalSegundos % 3600) / 60);
				const ss = totalSegundos % 60;
				const rank = rankMap.get(endereco);
				const categoria = rank <= 3 ? 'Top' : (rank > (rankingDesc.length - 3) ? 'Bottom' : 'Normal');
				return `\n<div class="apx-tooltip" style="background:#fff;border:1px solid #d0d7de;padding:8px 10px;border-radius:6px;box-shadow:0 4px 10px -2px rgba(0,0,0,.12);font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;line-height:1.35;min-width:230px;">\n  <div style='font-weight:600;margin-bottom:4px;color:#143956;'>${endereco}</div>\n  <div style='display:grid;grid-template-columns:90px 1fr;gap:2px 8px;'>\n    <span style='color:#555;'>Rank:</span><strong>#${rank}</strong>\n    <span style='color:#555;'>Categoria:</span><span style='font-weight:600;color:${categoria==='Top'?'#c62828':(categoria==='Bottom'?'#2e7d32':'#1f4e79')};'>${categoria}</span>\n    <span style='color:#555;'>Horas:</span><span>${val.toFixed(4)} h</span>\n    <span style='color:#555;'>HH:MM:SS:</span><span>${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}</span>\n  </div>\n</div>`;
			}
		},
		title: { text: 'Curva de Tempo Médio por Endereço', align: 'center' },
		colors: ['#1f4e79'],
		fill: {
			type: 'gradient',
			gradient: { shade: 'light', type: 'vertical', opacityFrom: 0.5, opacityTo: 0.05, stops: [0, 100] }
		},
		noData: { text: 'Sem dados' }
	};

	chartInstance = new ApexCharts(graficoContainer, options);
	chartInstance.render();
}

function showLoading(show) {
	if (!loadingOverlay) return;
	if (show) {
		loadingOverlay.classList.add('is-active');
	} else {
		loadingOverlay.classList.remove('is-active');
	}
}

function atualizarTimestampStatus() {
	if (!statusEl || !ultimoUpdate) return;
	// Anexa horário no final se já há algo
	const horas = String(ultimoUpdate.getHours()).padStart(2,'0');
	const mins = String(ultimoUpdate.getMinutes()).padStart(2,'0');
	const secs = String(ultimoUpdate.getSeconds()).padStart(2,'0');
	if (!/\(Atualizado/.test(statusEl.textContent)) {
		statusEl.textContent += ` | (Atualizado ${horas}:${mins}:${secs})`;
	} else {
		statusEl.textContent = statusEl.textContent.replace(/\(Atualizado.*\)/, `(Atualizado ${horas}:${mins}:${secs})`);
	}
}

function iniciarAutoRefresh() {
	if (agendador) clearInterval(agendador);
	agendador = setInterval(async () => {
		// Evitar sobreposição se ainda carregando
		if (loadingOverlay.classList.contains('is-active')) return;
		await carregarDados();
	}, INTERVALO_MS);
}

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
		// Re-render da tabela mantendo paginação atual
		if (dadosFiltradosAtuais.length) renderTabela(dadosFiltradosAtuais, true);
	}
});

// Inicialização: mostra loading, carrega módulos e dados filtrados
document.addEventListener('DOMContentLoaded', async () => {
	// Loading já está visível por padrão no HTML (inline style)
	try {
		await carregarModulos();
		await carregarDados();
	} finally {
		isBoot = false;
		showLoading(false);
		iniciarAutoRefresh();
	}
});

// Recalcula altura ao redimensionar janela
window.addEventListener('resize', () => {
    if (!chartInstance || graficoWrapper.style.display === 'none') return;
    const novaAltura = calcularAlturaGrafico();
    graficoContainer.style.height = novaAltura + 'px';
    chartInstance.updateOptions({ chart: { height: novaAltura } }, false, true);
});

// Eventos de paginação
if (pgPrimeira) pgPrimeira.addEventListener('click', () => irParaPagina(1));
if (pgAnterior) pgAnterior.addEventListener('click', () => irParaPagina(paginaAtual - 1));
if (pgProxima) pgProxima.addEventListener('click', () => irParaPagina(paginaAtual + 1));
if (pgUltima) pgUltima.addEventListener('click', () => irParaPagina(calcularTotalPaginas()));
if (pgSelect) pgSelect.addEventListener('change', e => irParaPagina(parseInt(e.target.value,10)));
if (pgTamanho) pgTamanho.addEventListener('change', () => { aplicarTamanhoPagina(); irParaPagina(1); });

