const turnosDisponiveis = ['Manhã', 'Tarde', 'Noite'];

function carregarTurnoSelecionado() {
	try {
		const turnoSalvo = localStorage.getItem('turnoSelecionado');
		return turnosDisponiveis.includes(turnoSalvo) ? turnoSalvo : '';
	} catch (erro) {
		return '';
	}
}

let turnoSelecionado = carregarTurnoSelecionado();
let inicioExpedienteEm = null;
let tempoPausadoAcumulado = 0;
let instantePausa = null;
let timerContadorExpediente = null;

const tarefasPadrao = [
	'Bater o ponto',
	'Perguntar ao operador da tarde se há demandas pendentes',
	'Mudar o nome da base de operação',
	'Enviar mensagem de confirmação para os QRAs das 19hs, 21hs, 22hs e 23hs',
	'Verificar se há lojas descobertas e encontrar FTs no grupo Coberturas',
	'Verificar se os FTs empenhados estão em seus respectivos grupos',
	'Atentar-se às demandas do Whatsapp, principalmente para as demandas da RD e White',
	'Atentar-se ao preenchimento da planilha de eventuais',
	'Iniciar o monitoramento dos postos vagos e eventuais',
	'Confirmação Postos no Whatsapp',
	'Envio dos e-mails',
	'Lançamento das "pagas"',
	'Fechar as lojas do turno da manhã, 6:40 e 7:00',
	'Confirmação dos empenhos com os QRAs da manhã',
	'Bater o ponto de saída',
	'Passagem de posto'
];

const tarefasPadraoNoite = [
	['Bater o Ponto de Entrada', 0],
	['Enviar confirmação para os QRAs das 19h, 21h, 22h e 23h', 30],
	['Perguntar ao operador da tarde se há demandas pendentes', 75],
	['Mudar o nome da base de operação', 120],
	['Verificar se há lojas descobertas e encontrar FTs no grupo Coberturas', 165],
	['Verificar se os FTs empenhados estão em seus respectivos grupos', 210],
	['Atentar-se às demandas do Whatsapp, principalmente para RD e White', 255],
	['Atentar-se ao preenchimento da planilha de eventuais', 300],
	['Início da Pausa Refeição', 360],
	['Retorno da Pausa Refeição', 420],
	['Iniciar o monitoramento dos postos vagos e eventuais', 465],
	['Confirmação Postos no Whatsapp', 510],
	['Envio dos e-mails', 555],
	['Lançamento das "pagas"', 600],
	['Fechar as lojas do turno da manhã, 6:40 e 7:00', 645],
	['Confirmação dos empenhos com os QRAs da manhã', 690],
	['Bater o Ponto de Saída', 720]
].map(([nome, minutoExpediente]) => ({ nome, minutoExpediente, intervaloMinutos: 5 }));

function converterHorarioLegadoParaMinutos(horario) {
	if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario || '')) return null;
	let [hora, minuto] = horario.split(':').map(Number);
	if (hora < 18) hora += 24;
	const minutosDesdeInicio = hora * 60 + minuto - 18 * 60;
	return minutosDesdeInicio >= 0 && minutosDesdeInicio <= 720 ? minutosDesdeInicio : null;
}

function formatarMinutosExpediente(minutos) {
	if (!Number.isInteger(minutos)) return '';
	const horas = Math.floor(minutos / 60).toString().padStart(2, '0');
	const restoMinutos = (minutos % 60).toString().padStart(2, '0');
	return `${horas}:${restoMinutos}`;
}

function formatarDuracaoExpediente(milissegundos) {
	const segundos = Math.floor(milissegundos / 1000);
	const horas = Math.floor(segundos / 3600).toString().padStart(2, '0');
	const minutos = Math.floor((segundos % 3600) / 60).toString().padStart(2, '0');
	const segundosRestantes = (segundos % 60).toString().padStart(2, '0');
	return `${horas}:${minutos}:${segundosRestantes}`;
}

function atualizarContadorExpediente() {
	if (inicioExpedienteEm === null) return;
	const agora = fluxoPausado && instantePausa !== null ? instantePausa : Date.now();
	const decorrido = Math.max(0, agora - inicioExpedienteEm - tempoPausadoAcumulado);
	const contador = document.getElementById('contador-tarefa');
	contador.textContent = `Tempo ${formatarDuracaoExpediente(decorrido)} / 12:00:00 · ${tarefasConcluidas} de ${tarefasFluxo.length} concluídas`;
}

function iniciarContadorExpediente() {
	clearInterval(timerContadorExpediente);
	atualizarContadorExpediente();
	timerContadorExpediente = setInterval(atualizarContadorExpediente, 1000);
}

function normalizarTarefas(tarefas, intervaloPadrao, turno) {
	return tarefas.map(tarefa => {
		if (typeof tarefa === 'string') {
			return { nome: tarefa, minutoExpediente: null, intervaloMinutos: intervaloPadrao };
		}

		if (tarefa && typeof tarefa.nome === 'string') {
			const intervalo = Number(tarefa.intervaloMinutos);
			const minutoSalvo = Number(tarefa.minutoExpediente);
			const minutoExpediente = Number.isInteger(minutoSalvo) && minutoSalvo >= 0 && minutoSalvo <= 720
				? minutoSalvo
				: turno === 'Noite' ? converterHorarioLegadoParaMinutos(tarefa.horario) : null;
			return {
				nome: tarefa.nome,
				minutoExpediente,
				intervaloMinutos: Number.isInteger(intervalo) && intervalo >= 1 ? intervalo : intervaloPadrao
			};
		}

		return null;
	}).filter(Boolean);
}

function carregarTarefas(turno = turnoSelecionado) {
	const intervaloAntigo = carregarIntervaloLembrete();
	const chaveTurno = `tarefasFluxo:${turno || 'Geral'}`;

	try {
		const tarefasDoTurno = localStorage.getItem(chaveTurno);
		if (tarefasDoTurno !== null) {
			const tarefasSalvas = JSON.parse(tarefasDoTurno);
			if (Array.isArray(tarefasSalvas)) return normalizarTarefas(tarefasSalvas, intervaloAntigo, turno);
		}
	} catch (erro) {
		return turno === 'Noite' ? tarefasPadraoNoite.map(tarefa => ({ ...tarefa })) : tarefasPadrao.map(nome => ({ nome, horario: '', intervaloMinutos: 5 }));
	}

	if (turno === 'Noite') return tarefasPadraoNoite.map(tarefa => ({ ...tarefa }));

	try {
		const tarefasAntigas = JSON.parse(localStorage.getItem('tarefasFluxo'));
		if (Array.isArray(tarefasAntigas)) return normalizarTarefas(tarefasAntigas, intervaloAntigo, turno);
	} catch (erro) {
		return tarefasPadrao.map(nome => ({ nome, horario: '', intervaloMinutos: 5 }));
	}

	return tarefasPadrao.map(nome => ({ nome, horario: '', intervaloMinutos: 5 }));
}

function carregarIntervaloLembrete() {
	try {
		const intervaloSalvo = Number(localStorage.getItem('intervaloLembreteMinutos'));
		return Number.isInteger(intervaloSalvo) && intervaloSalvo >= 1 ? intervaloSalvo : 5;
	} catch (erro) {
		return 5;
	}
}

let tarefasFluxo = carregarTarefas();
let filaExecucao = [];
let tarefaAtual = null;
let fluxoEmExecucao = false;
let fluxoPausado = false;
let tarefasConcluidas = 0;
let timerProximoLembrete = null;
let mostrarBotaoVoltarInicio = false;
let indiceTarefaSelecionada = null;
let modoFormularioTarefa = null;
let indiceAlvoFormulario = null;
let arrasteTarefa = null;
let ignorarCliqueAposArraste = false;

function atualizarTurnoSelecionado() {
	const indicador = document.getElementById('turno-selecionado');
	indicador.textContent = turnoSelecionado;
	indicador.hidden = !turnoSelecionado;
}

function alternarMenuTurnos() {
	const menu = document.getElementById('opcoes-turno');
	const botao = document.getElementById('btn-seletor-turno');
	menu.hidden = !menu.hidden;
	botao.setAttribute('aria-expanded', String(!menu.hidden));
}

function selecionarTurno(turno) {
	if (!turnosDisponiveis.includes(turno)) return;

	turnoSelecionado = turno;
	tarefasFluxo = carregarTarefas(turno);
	indiceTarefaSelecionada = null;
	try {
		localStorage.setItem('turnoSelecionado', turno);
	} catch (erro) {}
	fecharMenuTurnos();
	atualizarTurnoSelecionado();
}

function fecharMenuTurnos() {
	const menu = document.getElementById('opcoes-turno');
	const botao = document.getElementById('btn-seletor-turno');
	menu.hidden = true;
	botao.setAttribute('aria-expanded', 'false');
}

function limparLembretesPendentes() {
	clearTimeout(timerProximoLembrete);
	clearInterval(timerContadorExpediente);
	timerProximoLembrete = null;
	timerContadorExpediente = null;
	filaExecucao = [];
	tarefaAtual = null;
	tarefasConcluidas = 0;
	fluxoEmExecucao = false;
	fluxoPausado = false;
	inicioExpedienteEm = null;
	tempoPausadoAcumulado = 0;
	instantePausa = null;
}

function salvarTarefas() {
	localStorage.setItem(`tarefasFluxo:${turnoSelecionado || 'Geral'}`, JSON.stringify(tarefasFluxo));
}

function tarefaEmHorarioFixo(tarefa) {
	return turnoSelecionado === 'Noite' && [0, 360, 420, 720].includes(tarefa.minutoExpediente);
}

function podeMoverTarefa(indice, destino) {
	if (modoFormularioTarefa !== null || destino < 0 || destino >= tarefasFluxo.length) return false;
	if (turnoSelecionado !== 'Noite') return true;
	if (tarefaEmHorarioFixo(tarefasFluxo[indice])) return false;

	const primeiroIndice = Math.min(indice, destino);
	const ultimoIndice = Math.max(indice, destino);
	for (let posicao = primeiroIndice; posicao <= ultimoIndice; posicao += 1) {
		if (posicao !== indice && tarefaEmHorarioFixo(tarefasFluxo[posicao])) return false;
	}
	return true;
}

function renderizarListaTarefas() {
	const lista = document.getElementById('lista-tarefas-editor');
	lista.replaceChildren();

	if (tarefasFluxo.length === 0) {
		const itemVazio = document.createElement('li');
		itemVazio.className = 'tarefa-editor-vazia';
		itemVazio.textContent = 'Nenhuma tarefa cadastrada.';
		lista.appendChild(itemVazio);
		return;
	}

	tarefasFluxo.forEach((tarefa, indice) => {
		const item = document.createElement('li');
		item.dataset.indiceTarefa = String(indice);
		const linha = document.createElement('div');
		linha.className = 'linha-tarefa-editor';
		const botao = document.createElement('button');
		botao.type = 'button';
		botao.className = 'item-tarefa-editor';
		const horario = Number.isInteger(tarefa.minutoExpediente)
			? ` · +${formatarMinutosExpediente(tarefa.minutoExpediente)} do início`
			: '';
		botao.textContent = `${indice + 1}. ${tarefa.nome}${horario} · a cada ${tarefa.intervaloMinutos} min`;
		botao.setAttribute('aria-pressed', String(indice === indiceTarefaSelecionada));
		botao.disabled = modoFormularioTarefa !== null;
		botao.addEventListener('click', () => {
			if (ignorarCliqueAposArraste) {
				ignorarCliqueAposArraste = false;
				return;
			}
			indiceTarefaSelecionada = indice;
			renderizarListaTarefas();
		});
		botao.addEventListener('pointerdown', event => iniciarArrasteTarefa(event, indice, item, lista));
		botao.addEventListener('pointermove', atualizarArrasteTarefa);
		botao.addEventListener('pointerup', finalizarArrasteTarefa);
		botao.addEventListener('pointercancel', cancelarArrasteTarefa);
		botao.addEventListener('keydown', event => {
			if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
			event.preventDefault();
			reordenarTarefa(indice, indice + (event.key === 'ArrowUp' ? -1 : 1));
		});

		linha.append(botao);
		item.appendChild(linha);
		lista.appendChild(item);
	});
}

function iniciarArrasteTarefa(event, indice, item, lista) {
	if (event.button !== 0 || modoFormularioTarefa !== null) return;
	arrasteTarefa = {
		pointerId: event.pointerId,
		indice,
		inicioX: event.clientX,
		inicioY: event.clientY,
		item,
		lista,
		arrastou: false,
		destino: indice
	};
	event.currentTarget.setPointerCapture(event.pointerId);
}

function atualizarArrasteTarefa(event) {
	if (!arrasteTarefa || event.pointerId !== arrasteTarefa.pointerId) return;
	if (!arrasteTarefa.arrastou) {
		const deslocamentoX = Math.abs(event.clientX - arrasteTarefa.inicioX);
		const deslocamentoY = Math.abs(event.clientY - arrasteTarefa.inicioY);
		if (Math.max(deslocamentoX, deslocamentoY) < 8) return;
		arrasteTarefa.arrastou = true;
		arrasteTarefa.item.classList.add('arrastando');
	}

	event.preventDefault();
	const lista = arrasteTarefa.lista;
	const limite = lista.getBoundingClientRect();
	if (event.clientY < limite.top + 36) lista.scrollTop -= 12;
	if (event.clientY > limite.bottom - 36) lista.scrollTop += 12;

	lista.querySelectorAll('.alvo-arraste, .alvo-arraste-invalido').forEach(item => {
		item.classList.remove('alvo-arraste', 'alvo-arraste-invalido');
	});
	const alvo = document.elementFromPoint(event.clientX, event.clientY)?.closest('li[data-indice-tarefa]');
	if (!alvo || !lista.contains(alvo)) {
		arrasteTarefa.destino = null;
		return;
	}

	const indiceAlvo = Number(alvo.dataset.indiceTarefa);
	const destino = indiceAlvo;
	arrasteTarefa.destino = podeMoverTarefa(arrasteTarefa.indice, destino) ? destino : null;
	alvo.classList.add(arrasteTarefa.destino === null ? 'alvo-arraste-invalido' : 'alvo-arraste');
}

function finalizarArrasteTarefa(event) {
	if (!arrasteTarefa || event.pointerId !== arrasteTarefa.pointerId) return;
	const { indice, destino, item, lista, arrastou } = arrasteTarefa;
	arrasteTarefa = null;
	item.classList.remove('arrastando');
	lista.querySelectorAll('.alvo-arraste, .alvo-arraste-invalido').forEach(alvo => {
		alvo.classList.remove('alvo-arraste', 'alvo-arraste-invalido');
	});

	if (!arrastou) return;
	ignorarCliqueAposArraste = true;
	setTimeout(() => {
		ignorarCliqueAposArraste = false;
	}, 0);
	if (destino !== null && destino !== indice) reordenarTarefa(indice, destino);
}

function cancelarArrasteTarefa(event) {
	if (!arrasteTarefa || event.pointerId !== arrasteTarefa.pointerId) return;
	arrasteTarefa.item.classList.remove('arrastando');
	arrasteTarefa.lista.querySelectorAll('.alvo-arraste, .alvo-arraste-invalido').forEach(alvo => {
		alvo.classList.remove('alvo-arraste', 'alvo-arraste-invalido');
	});
	arrasteTarefa = null;
}

function reordenarTarefa(origem, destino) {
	if (!podeMoverTarefa(origem, destino) || origem === destino) return;

	const horariosDasPosicoes = tarefasFluxo.map(tarefa => tarefa.minutoExpediente);
	const [tarefaMovida] = tarefasFluxo.splice(origem, 1);
	tarefasFluxo.splice(destino, 0, tarefaMovida);
	tarefasFluxo.forEach((tarefa, indice) => {
		tarefa.minutoExpediente = horariosDasPosicoes[indice];
	});
	indiceTarefaSelecionada = destino;
	salvarTarefas();
	renderizarListaTarefas();
}

function adicionarTarefa() {
	modoFormularioTarefa = 'adicionar';
	indiceAlvoFormulario = indiceTarefaSelecionada === null
		? tarefasFluxo.length
		: indiceTarefaSelecionada + 1;
	abrirFormularioTarefa('', 5, '');
}

function editarTarefa() {
	if (indiceTarefaSelecionada === null) {
		alert('Selecione uma tarefa para editar.');
		return;
	}

	modoFormularioTarefa = 'editar';
	indiceAlvoFormulario = indiceTarefaSelecionada;
	const tarefa = tarefasFluxo[indiceAlvoFormulario];
	abrirFormularioTarefa(tarefa.nome, tarefa.intervaloMinutos, tarefa.minutoExpediente);
}

function abrirFormularioTarefa(nome, intervaloMinutos, minutoExpediente) {
	document.getElementById('nome-tarefa').value = nome;
	document.getElementById('horario-tarefa').value = Number.isInteger(minutoExpediente)
		? formatarMinutosExpediente(minutoExpediente)
		: '';
	document.getElementById('intervalo-tarefa').value = intervaloMinutos;
	document.getElementById('formulario-tarefa').hidden = false;
	document.getElementById('acoes-editor').style.display = 'none';
	renderizarListaTarefas();
	document.getElementById('nome-tarefa').focus();
}

function cancelarFormularioTarefa() {
	modoFormularioTarefa = null;
	indiceAlvoFormulario = null;
	document.getElementById('formulario-tarefa').hidden = true;
	document.getElementById('acoes-editor').style.display = '';
	renderizarListaTarefas();
}

function salvarFormularioTarefa() {
	const campoNome = document.getElementById('nome-tarefa');
	const campoHorario = document.getElementById('horario-tarefa');
	const campoIntervalo = document.getElementById('intervalo-tarefa');
	const nome = campoNome.value.trim();
	const tempoInformado = campoHorario.value;
	const minutoExpediente = tempoInformado
		? Number(tempoInformado.slice(0, 2)) * 60 + Number(tempoInformado.slice(3, 5))
		: null;
	const intervaloMinutos = Number(campoIntervalo.value);

	if (!nome) {
		campoNome.setCustomValidity('Informe o nome da tarefa.');
		campoNome.reportValidity();
		campoNome.addEventListener('input', () => campoNome.setCustomValidity(''), { once: true });
		return;
	}
	if (!campoIntervalo.checkValidity()) {
		campoIntervalo.reportValidity();
		return;
	}
	if (tempoInformado && !campoHorario.checkValidity()) {
		campoHorario.reportValidity();
		return;
	}

	const tarefa = { nome, minutoExpediente, intervaloMinutos };
	if (modoFormularioTarefa === 'editar') {
		tarefasFluxo[indiceAlvoFormulario] = tarefa;
		indiceTarefaSelecionada = indiceAlvoFormulario;
	} else {
		tarefasFluxo.splice(indiceAlvoFormulario, 0, tarefa);
		indiceTarefaSelecionada = indiceAlvoFormulario;
	}

	salvarTarefas();
	cancelarFormularioTarefa();
}

function excluirTarefa() {
	if (indiceTarefaSelecionada === null) {
		alert('Selecione uma tarefa para excluir.');
		return;
	}

	if (!confirm(`Excluir a tarefa "${tarefasFluxo[indiceTarefaSelecionada].nome}"?`)) return;

	tarefasFluxo.splice(indiceTarefaSelecionada, 1);
	indiceTarefaSelecionada = tarefasFluxo.length === 0
		? null
		: Math.min(indiceTarefaSelecionada, tarefasFluxo.length - 1);
	salvarTarefas();
	renderizarListaTarefas();
}

function ajustarLembreteForaDaPausa(horario) {
	if (turnoSelecionado !== 'Noite' || inicioExpedienteEm === null) return horario;

	const inicioPausa = inicioExpedienteEm + 6 * 60 * 60 * 1000;
	const fimPausa = inicioExpedienteEm + 7 * 60 * 60 * 1000;
	return horario >= inicioPausa && horario < fimPausa ? fimPausa : horario;
}

function iniciarExpediente(mostrarVoltar = false) {
	limparLembretesPendentes();
	const agora = Date.now();
	inicioExpedienteEm = agora;
	tempoPausadoAcumulado = 0;
	instantePausa = null;
	filaExecucao = tarefasFluxo.map((tarefa, indice) => {
		const horarioProgramado = turnoSelecionado === 'Noite' && Number.isInteger(tarefa.minutoExpediente)
			? agora + tarefa.minutoExpediente * 60 * 1000
			: agora;
		return {
			id: indice,
			tarefa,
			pendente: false,
			disponivelEm: horarioProgramado
		};
	}).sort((primeira, segunda) => primeira.disponivelEm - segunda.disponivelEm || primeira.id - segunda.id);
	fluxoPausado = false;
	tarefaAtual = null;
	fluxoEmExecucao = true;
	mostrarBotaoVoltarInicio = mostrarVoltar;

	document.getElementById('tela-inicial').style.display = 'none';
	document.getElementById('seletor-turno').hidden = true;
	document.getElementById('tela-edicao').style.display = 'none';
	document.getElementById('tela-tarefa').style.display = 'block';
	document.getElementById('controles-tarefa').style.display = 'flex';
	document.getElementById('mensagem-espera').hidden = true;
	document.getElementById('estado-pausado').hidden = true;
	document.getElementById('btn-menu-fluxo').hidden = false;
	document.getElementById('btn-voltar-inicio').hidden = !mostrarBotaoVoltarInicio;
	fecharMenuFluxo();
	iniciarContadorExpediente();

	exibirTarefaAtual();
}

function exibirTarefaAtual() {
	const titulo = document.getElementById('titulo-tarefa');
	const controles = document.getElementById('controles-tarefa');
	const mensagemEspera = document.getElementById('mensagem-espera');
	const botaoVoltar = document.getElementById('btn-voltar-inicio');
	const agora = Date.now();
	const indicePronta = filaExecucao.findIndex(item => item.disponivelEm <= agora);

	if (fluxoPausado) return;

	clearTimeout(timerProximoLembrete);
	timerProximoLembrete = null;
	botaoVoltar.hidden = !mostrarBotaoVoltarInicio;
	mensagemEspera.hidden = true;
	document.getElementById('estado-pausado').hidden = true;

	if (tarefaAtual) {
		atualizarContadorExpediente();
		titulo.textContent = tarefaAtual.pendente
			? `Pendente: ${tarefaAtual.tarefa.nome}`
			: `${tarefasConcluidas + 1} de ${tarefasFluxo.length}: ${tarefaAtual.tarefa.nome}`;
		controles.style.display = 'flex';
		return;
	}

	if (indicePronta !== -1) {
		tarefaAtual = filaExecucao.splice(indicePronta, 1)[0];
		atualizarContadorExpediente();
		titulo.textContent = tarefaAtual.pendente
			? `Pendente: ${tarefaAtual.tarefa.nome}`
			: `${tarefasConcluidas + 1} de ${tarefasFluxo.length}: ${tarefaAtual.tarefa.nome}`;
		controles.style.display = 'flex';
		return;
	}

	tarefaAtual = null;
	controles.style.display = 'none';

	if (filaExecucao.length > 0) {
		const proximoItem = filaExecucao.reduce((proximo, item) => item.disponivelEm < proximo.disponivelEm ? item : proximo);
		const proximoHorario = proximoItem.disponivelEm;
		const minutosRestantes = Math.max(1, Math.ceil((proximoHorario - agora) / 60000));
		atualizarContadorExpediente();
		if (!proximoItem.pendente && turnoSelecionado === 'Noite') {
			const minutoPrevisto = Math.round((proximoHorario - inicioExpedienteEm) / 60000);
			const horarioTexto = formatarMinutosExpediente(minutoPrevisto);
			titulo.textContent = `Próxima tarefa: ${proximoItem.tarefa.nome}`;
			mensagemEspera.textContent = `Programada para ${horarioTexto} após o início do expediente.`;
		} else {
			const tarefasAguardando = filaExecucao.filter(item => item.pendente).length;
			mensagemEspera.textContent = `Aguardando ${tarefasAguardando} tarefa(s) pendente(s). Próximo lembrete em aproximadamente ${minutosRestantes} min.`;
		}
		mensagemEspera.hidden = false;
		timerProximoLembrete = setTimeout(exibirTarefaAtual, Math.max(1, proximoHorario - agora));
		return;
	}

	fluxoEmExecucao = false;
	clearInterval(timerContadorExpediente);
	timerContadorExpediente = null;
	atualizarContadorExpediente();
	titulo.textContent = 'Fluxo concluído!';
	botaoVoltar.hidden = false;
	document.getElementById('btn-menu-fluxo').hidden = true;
}

function proximaTarefa() {
	if (!tarefaAtual) return;
	tarefasConcluidas += 1;
	tarefaAtual = null;
	exibirTarefaAtual();
}

function adiarTarefa() {
	if (!tarefaAtual) return;

	tarefaAtual.pendente = true;
	tarefaAtual.disponivelEm = ajustarLembreteForaDaPausa(
		Date.now() + tarefaAtual.tarefa.intervaloMinutos * 60 * 1000
	);
	filaExecucao.push(tarefaAtual);
	tarefaAtual = null;
	exibirTarefaAtual();
}

function alternarMenuFluxo() {
	const menu = document.getElementById('opcoes-fluxo');
	const botao = document.getElementById('btn-menu-fluxo');
	if (!menu || !botao) return;
	menu.hidden = !menu.hidden;
	botao.setAttribute('aria-expanded', String(!menu.hidden));
}

function fecharMenuFluxo() {
	const menu = document.getElementById('opcoes-fluxo');
	const botao = document.getElementById('btn-menu-fluxo');
	if (menu) menu.hidden = true;
	if (botao) botao.setAttribute('aria-expanded', 'false');
}

function pausarFluxo() {
	if (!fluxoEmExecucao || fluxoPausado) return;

	fecharMenuFluxo();
	clearTimeout(timerProximoLembrete);
	timerProximoLembrete = null;
	const agora = Date.now();
	filaExecucao.forEach(item => {
		item.tempoRestante = Math.max(0, item.disponivelEm - agora);
	});
	fluxoPausado = true;
	instantePausa = agora;
	clearInterval(timerContadorExpediente);
	timerContadorExpediente = null;
	atualizarContadorExpediente();
	document.getElementById('controles-tarefa').style.display = 'none';
	document.getElementById('mensagem-espera').hidden = true;
	document.getElementById('estado-pausado').hidden = false;
}

function retomarFluxo() {
	if (!fluxoPausado) return;

	const agora = Date.now();
	filaExecucao.forEach(item => {
		item.disponivelEm = agora + item.tempoRestante;
		delete item.tempoRestante;
	});
	tempoPausadoAcumulado += agora - instantePausa;
	instantePausa = null;
	fluxoPausado = false;
	iniciarContadorExpediente();
	document.getElementById('estado-pausado').hidden = true;
	exibirTarefaAtual();
}

function reiniciarFluxo() {
	fecharMenuFluxo();
	if (!confirm('Reiniciar o fluxo e descartar o progresso atual?')) return;
	iniciarExpediente(true);
}

function encerrarFluxo() {
	fecharMenuFluxo();
	if (!confirm('Encerrar o fluxo agora? As tarefas ainda não concluídas serão descartadas.')) return;
	limparLembretesPendentes();
	mostrarBotaoVoltarInicio = true;
	document.getElementById('tela-inicial').style.display = 'none';
	document.getElementById('tela-edicao').style.display = 'none';
	document.getElementById('tela-tarefa').style.display = 'block';
	document.getElementById('titulo-tarefa').textContent = 'Fluxo encerrado';
	document.getElementById('contador-tarefa').textContent = '';
	document.getElementById('controles-tarefa').style.display = 'none';
	document.getElementById('mensagem-espera').hidden = true;
	document.getElementById('estado-pausado').hidden = true;
	document.getElementById('btn-menu-fluxo').hidden = true;
	document.getElementById('btn-voltar-inicio').hidden = false;
}

function abrirEditor() {
	document.getElementById('tela-inicial').style.display = 'none';
	document.getElementById('seletor-turno').hidden = true;
	document.getElementById('tela-tarefa').style.display = 'none';
	document.getElementById('tela-edicao').style.display = 'block';
	modoFormularioTarefa = null;
	indiceAlvoFormulario = null;
	document.getElementById('formulario-tarefa').hidden = true;
	document.getElementById('acoes-editor').style.display = '';
	renderizarListaTarefas();
}

function voltarTelaInicial() {
	limparLembretesPendentes();
	mostrarBotaoVoltarInicio = false;
	document.getElementById('seletor-turno').hidden = false;
	document.getElementById('tela-edicao').style.display = 'none';
	document.getElementById('tela-tarefa').style.display = 'none';
	document.getElementById('tela-inicial').style.display = 'block';
}

atualizarTurnoSelecionado();
