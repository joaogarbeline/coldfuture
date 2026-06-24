import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { controleApi } from '../services/api';
import type { StatusControle, Comando, ComandoPayload, SetpointPayload, SetpointValues } from '../types';

export function useStatusControle(maquinaId: number | null) {
  return useQuery<StatusControle>({
    queryKey: ['status-controle', maquinaId],
    queryFn: () => controleApi.lerStatusControle(maquinaId!),
    enabled: maquinaId !== null,
    refetchInterval: 10000,
    retry: 1,
  });
}

export function useSetpoints(maquinaId: number | null) {
  return useQuery<SetpointValues>({
    queryKey: ['setpoints', maquinaId],
    queryFn: () => controleApi.lerSetpoints(maquinaId!),
    enabled: maquinaId !== null,
    refetchInterval: 15000,
    retry: 1,
  });
}

export function useEnviarComando() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ maquinaId, data }: { maquinaId: number; data: ComandoPayload }) =>
      controleApi.enviarComando(maquinaId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['status-controle', variables.maquinaId] });
      queryClient.invalidateQueries({ queryKey: ['comandos'] });
    },
  });
}

export function useAlterarSetpoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ maquinaId, data }: { maquinaId: number; data: SetpointPayload }) =>
      controleApi.alterarSetpoint(maquinaId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['setpoints', variables.maquinaId] });
      queryClient.invalidateQueries({ queryKey: ['status-controle', variables.maquinaId] });
      queryClient.invalidateQueries({ queryKey: ['comandos'] });
    },
  });
}

export function useHistoricoComandos(maquinaId: number | null) {
  return useQuery<Comando[]>({
    queryKey: ['comandos', maquinaId],
    queryFn: () =>
      controleApi.listarComandos({
        maquina: maquinaId ?? undefined,
        limit: 50,
      }),
    enabled: maquinaId !== null,
    refetchInterval: 15000,
  });
}
