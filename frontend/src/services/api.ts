import axios from 'axios';
import type {
  Maquina,
  Leitura,
  Estatisticas,
  CriarMaquinaPayload,
  AtualizarMaquinaPayload,
  PeriodoParams,
  StatusControle,
  Comando,
  ComandoPayload,
  SetpointPayload,
  SetpointValues,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('coldvisio-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: (usuario: string, senha: string) =>
    api.post('/login', { usuario, senha }).then((r) => r.data),
};

export const maquinasApi = {
  listar: () => api.get<Maquina[]>('/maquinas').then((r) => r.data),

  criar: (data: CriarMaquinaPayload) =>
    api.post<Maquina>('/maquinas', data).then((r) => r.data),

  atualizar: (id: number, data: AtualizarMaquinaPayload) =>
    api.put<Maquina>(`/maquinas/${id}`, data).then((r) => r.data),

  remover: (id: number) =>
    api.delete(`/maquinas/${id}`).then((r) => r.data),

  atualizarSetpoints: (id: number, data: any) =>
    api.put('/maquinas/' + id + '/setpoints', data).then((r) => r.data),

  descobrir: () =>
    api.get('/maquinas/descobrir').then((r) => r.data),
};

export const leiturasApi = {
  listar: (limit = 100, offset = 0) =>
    api.get<Leitura[]>('/leituras', { params: { limit, offset } }).then((r) => r.data),

  listarPorMaquina: (maquinaId: number, limit = 100, offset = 0) =>
    api.get<Leitura[]>(`/leituras/${maquinaId}`, { params: { limit, offset } }).then((r) => r.data),

  ultima: (maquinaId: number) =>
    api.get<Leitura>(`/ultima/${maquinaId}`).then((r) => r.data),

  cache: () =>
    api.get('/cache').then((r) => r.data),

  buscarPorPeriodo: (params: PeriodoParams) =>
    api.get<Leitura[]>('/periodo', { params }).then((r) => r.data),

  estatisticas: (maquinaId: number) =>
    api.get<Estatisticas>(`/estatisticas/${maquinaId}`).then((r) => r.data),

  estatisticasDiarias: (maquinaId: number, data: string) =>
    api.get('/estatisticas-diarias/' + maquinaId, { params: { data } }).then((r) => r.data),

  buscarPorPeriodoMultiplas: (params: any) =>
    api.get('/periodo-multiplas', { params }).then((r) => r.data),

  exportarCSV: (params: any) =>
    api.get('/periodo/export', { params, responseType: 'blob' }).then((r) => r.data),
};

export const resumoDiarioApi = {
  buscar: (params?: any) => api.get('/resumo-diario', { params }).then((r) => r.data),

  resumoDiarioPeriodo: (params: any) => api.get('/resumo-diario', { params }).then(r => r.data),
};

export const controleApi = {
  enviarComando: (maquinaId: number, data: ComandoPayload) =>
    api.post<Comando>(`/maquinas/${maquinaId}/comando`, data).then((r) => r.data),

  lerStatusControle: (maquinaId: number) =>
    api.get<StatusControle>(`/maquinas/${maquinaId}/status-controle`).then((r) => r.data),

  lerSetpoints: (maquinaId: number) =>
    api.get<SetpointValues>(`/maquinas/${maquinaId}/setpoints`).then((r) => r.data),

  alterarSetpoint: (maquinaId: number, data: SetpointPayload) =>
    api.put<Comando>(`/maquinas/${maquinaId}/setpoint`, data).then((r) => r.data),

  listarComandos: (params?: { maquina?: number; limit?: number; offset?: number }) =>
    api.get<Comando[]>('/comandos', { params }).then((r) => r.data),
};

export interface ModbusConfig {
  modbus_modo: string;
  modbus_porta: string;
  modbus_baudrate: number;
  modbus_parity: string;
  modbus_stopbits: number;
  modbus_tcp_host: string;
  modbus_tcp_port: number;
  modbus_timeout: number;
  read_interval: number;
}

export const configApi = {
  buscar: () =>
    api.get<ModbusConfig>('/configuracao-sistema').then((r) => r.data),

  salvarModbus: (data: Partial<ModbusConfig>) =>
    api.put('/configuracao-sistema', data).then((r) => r.data),
};

export default api;
