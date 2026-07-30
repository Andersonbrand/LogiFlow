/**
 * desempenhoMotoristaService.js
 * Painel de Desempenho de Motoristas (visão admin, módulo Carretas).
 *
 * Cruza dados de duas tabelas que já existem e não são alteradas por este
 * arquivo:
 *  - carretas_pontos_parada  → KM rodado e horas trabalhadas (registrados
 *    pelo motorista na tela do carreteiro, aba "Pontos de Parada")
 *  - carretas_abastecimentos → litros e gasto com combustível
 *
 * Nada aqui grava dados novos — é só leitura + cálculo, pensado para
 * alimentar uma aba nova no painel admin. Não afeta as telas do motorista.
 */
import { fetchPontosParadaAdmin, fetchAbastecimentos } from './carretasService';

// ── Limites de jornada (padrão CLT) ─────────────────────────────────────────
export const LIMITE_HORAS_DIA    = 8;
export const LIMITE_HORAS_SEMANA = 44;

const n = v => Number(v) || 0;

// ─────────────────────────────────────────────────────────────────────────
// Helpers de data/hora
// ─────────────────────────────────────────────────────────────────────────

// Junta data (YYYY-MM-DD) + horário (HH:MM) num Date. Retorna null se faltar
// alguma das duas partes (não dá pra calcular duração sem os dois).
function paraDataHora(data, horario) {
    if (!data || !horario) return null;
    // O horário pode vir como "HH:MM" (input do formulário) ou "HH:MM:SS"
    // (é assim que o Postgres devolve uma coluna `time`) — sem essa checagem,
    // "HH:MM:SS" virava "HH:MM:SS:00", uma data inválida, e todo o cálculo
    // de horas trabalhadas zerava (era exatamente esse o bug reportado).
    const horarioNormalizado = horario.length === 5 ? `${horario}:00` : horario;
    const d = new Date(`${data}T${horarioNormalizado}`);
    return isNaN(d.getTime()) ? null : d;
}

// Diferença em horas (decimal) entre saída e chegada. Retorna 0 se algo
// estiver incompleto ou se a chegada for anterior à saída (registro incompleto/errado).
function diffHoras(dataSaida, horarioSaida, dataChegada, horarioChegada) {
    const ini = paraDataHora(dataSaida, horarioSaida);
    const fim = paraDataHora(dataChegada, horarioChegada);
    if (!ini || !fim) return 0;
    const h = (fim.getTime() - ini.getTime()) / 3600000;
    return h > 0 ? h : 0;
}

// KM rodado entre saída e chegada. Retorna 0 se faltar algum dos dois ou se
// vier negativo (odômetro digitado errado).
function diffKm(kmSaida, kmChegada) {
    if (kmSaida == null || kmChegada == null || kmSaida === '' || kmChegada === '') return 0;
    const km = Number(kmChegada) - Number(kmSaida);
    return km > 0 ? km : 0;
}

// Segunda-feira da semana de uma data (usada como chave de agrupamento semanal).
function inicioDaSemana(dataStr) {
    const d = new Date(`${dataStr}T00:00:00`);
    const diaSemana = d.getDay(); // 0 = domingo
    const offset = diaSemana === 0 ? -6 : 1 - diaSemana;
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────────────────
// Cálculo por registro de parada (considera o ponto principal + o extra,
// já que um único registro pode conter os dois — ver tela do carreteiro)
// ─────────────────────────────────────────────────────────────────────────
export function calcularKmHorasDoPonto(ponto) {
    let km = diffKm(ponto.km_saida, ponto.km_chegada);
    let horas = diffHoras(ponto.data_saida, ponto.horario_saida, ponto.data_chegada, ponto.horario_chegada);
    let paradas = 1;

    (ponto.horarios_extras || []).forEach(ex => {
        km    += diffKm(ex.km_saida, ex.km_chegada);
        horas += diffHoras(ex.data_saida, ex.horario_saida, ex.data_chegada, ex.horario_chegada);
        paradas += 1;
    });

    return { km, horas, paradas };
}

// ─────────────────────────────────────────────────────────────────────────
// Agregação por motorista: totais de KM/horas/paradas + abastecimentos +
// consumo médio (km rodado do veículo no período ÷ litros abastecidos)
// ─────────────────────────────────────────────────────────────────────────
export function agruparDesempenhoPorMotorista(pontos, abastecimentos) {
    const porMotorista = {};

    const getMotorista = (id, nome) => {
        if (!porMotorista[id]) {
            porMotorista[id] = {
                motoristaId: id,
                nome: nome || 'Sem nome',
                kmTotal: 0,
                horasTotal: 0,
                paradasTotal: 0,
                litrosDiesel: 0,
                litrosArla: 0,
                gastoTotal: 0,
                kmPorVeiculo: {},   // veiculoId -> km rodado (pro cálculo de consumo médio)
            };
        }
        return porMotorista[id];
    };

    pontos.forEach(p => {
        const id = p.motorista_id;
        if (!id) return;
        const m = getMotorista(id, p.motorista?.name);
        const { km, horas, paradas } = calcularKmHorasDoPonto(p);
        m.kmTotal    += km;
        m.horasTotal += horas;
        m.paradasTotal += paradas;
        if (p.veiculo_id) {
            m.kmPorVeiculo[p.veiculo_id] = (m.kmPorVeiculo[p.veiculo_id] || 0) + km;
        }
    });

    abastecimentos.forEach(a => {
        const id = a.motorista_id;
        if (!id) return;
        const m = getMotorista(id, a.motorista?.name);
        m.litrosDiesel += n(a.litros_diesel);
        m.litrosArla   += n(a.litros_arla);
        m.gastoTotal   += n(a.valor_diesel) + n(a.valor_arla);
    });

    return Object.values(porMotorista)
        .map(m => {
            const litrosTotal = m.litrosDiesel; // consumo é calculado sobre diesel (arla não entra, pois não move o veículo)
            // Litros por Quilômetro (L/km): quantos litros são gastos para rodar 1 km.
            // Ex.: 2.856,5 L ÷ 2.530 km = 1,1291 L/km
            const consumoMedio = m.kmTotal > 0 ? litrosTotal / m.kmTotal : null; // L/km
            return { ...m, litrosTotal, consumoMedio };
        })
        .sort((a, b) => b.kmTotal - a.kmTotal);
}

// ─────────────────────────────────────────────────────────────────────────
// Alerta de jornada: 8h/dia e 44h/semana (valores padrão, ver constantes
// no topo do arquivo). Agrupa por motorista + semana (segunda a domingo).
// ─────────────────────────────────────────────────────────────────────────
export function calcularAlertasJornada(pontos, { limiteDiario = LIMITE_HORAS_DIA, limiteSemanal = LIMITE_HORAS_SEMANA } = {}) {
    const porMotoristaDia    = {}; // `${motoristaId}|${data}` -> horas
    const porMotoristaSemana = {}; // `${motoristaId}|${semana}` -> { horas, nome, semana }

    pontos.forEach(p => {
        const id = p.motorista_id;
        if (!id || !p.data_saida) return;
        const nome = p.motorista?.name || 'Sem nome';
        const { horas } = calcularKmHorasDoPonto(p);
        if (horas <= 0) return;

        const chaveDia = `${id}|${p.data_saida}`;
        porMotoristaDia[chaveDia] = (porMotoristaDia[chaveDia] || 0) + horas;

        const semana = inicioDaSemana(p.data_saida);
        const chaveSemana = `${id}|${semana}`;
        if (!porMotoristaSemana[chaveSemana]) {
            porMotoristaSemana[chaveSemana] = { motoristaId: id, nome, semana, horas: 0 };
        }
        porMotoristaSemana[chaveSemana].horas += horas;
    });

    const alertasDiarios = Object.entries(porMotoristaDia)
        .filter(([, horas]) => horas > limiteDiario)
        .map(([chave, horas]) => {
            const [motoristaId, data] = chave.split('|');
            const nome = pontos.find(p => p.motorista_id === motoristaId)?.motorista?.name || 'Sem nome';
            return { motoristaId, nome, data, horas: Number(horas.toFixed(1)), tipo: 'diario', limite: limiteDiario };
        });

    const alertasSemanais = Object.values(porMotoristaSemana)
        .filter(s => s.horas > limiteSemanal)
        .map(s => ({ ...s, horas: Number(s.horas.toFixed(1)), tipo: 'semanal', limite: limiteSemanal }));

    return { alertasDiarios, alertasSemanais };
}

// ─────────────────────────────────────────────────────────────────────────
// Orquestrador: busca os dados do período e devolve tudo já calculado,
// pronto para a aba do painel admin consumir.
// ─────────────────────────────────────────────────────────────────────────
export async function fetchDesempenhoMotoristas({ dataInicio, dataFim } = {}) {
    const [pontos, abastecimentos] = await Promise.all([
        fetchPontosParadaAdmin({ dataInicio, dataFim }),
        fetchAbastecimentos({ dataInicio, dataFim, apenasCarretas: true }),
    ]);

    const porMotorista = agruparDesempenhoPorMotorista(pontos, abastecimentos);
    const { alertasDiarios, alertasSemanais } = calcularAlertasJornada(pontos, {
        limiteDiario: LIMITE_HORAS_DIA,
        limiteSemanal: LIMITE_HORAS_SEMANA,
    });

    return { porMotorista, alertasDiarios, alertasSemanais, totalPontos: pontos.length };
}
