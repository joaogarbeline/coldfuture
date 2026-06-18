export interface Maquina {
  id: number;
  nome: string;
  endereco_modbus: number;
  ativo: boolean;
  setpoint_temp_max?: number;
  setpoint_temp_min?: number;
  setpoint_umid_max?: number;
  setpoint_umid_min?: number;
}

export interface Leitura {
  id: number;
  maquina_id: number;
  temperatura: number | null;
  umidade: number | null;
  setpoint_temperatura: number | null;
  setpoint_umidade: number | null;
  alarmes: number | null;
  status: number | null;
  data_hora: string;
  maquina?: Maquina;
}

export interface Estatisticas {
  temperatura_max: number | null;
  temperatura_min: number | null;
  temperatura_media: number | null;
  umidade_max: number | null;
  umidade_min: number | null;
  umidade_media: number | null;
}

export interface CriarMaquinaPayload {
  nome: string;
  endereco_modbus: number;
}

export interface AtualizarMaquinaPayload {
  nome: string;
  endereco_modbus: number;
  ativo: boolean;
}

export interface PeriodoParams {
  inicio?: string;
  fim?: string;
  maquina?: number;
  limit?: number;
  offset?: number;
}

export interface EstatisticasDiarias {
  hora: string;
  temperatura_max: number;
  temperatura_min: number;
  temperatura_media: number;
  umidade_max: number;
  umidade_min: number;
  umidade_media: number;
}

export interface ConfiguracaoApp {
  modbus_port: string;
  modbus_baudrate: number;
  modbus_parity: string;
  modbus_stopbits: number;
  read_interval: number;
}
