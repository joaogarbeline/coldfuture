import { useQuery } from '@tanstack/react-query';
import { leiturasApi } from '../services/api';
import type { Leitura, Estatisticas, PeriodoParams } from '../types';

export function useLeiturasPorMaquina(maquinaId: number | null, limit = 100) {
  return useQuery<Leitura[]>({
    queryKey: ['leituras', 'maquina', maquinaId, limit],
    queryFn: () => leiturasApi.listarPorMaquina(maquinaId!, limit),
    enabled: maquinaId !== null,
  });
}

export function useUltimaLeitura(maquinaId: number | null) {
  return useQuery<Leitura>({
    queryKey: ['ultima-leitura', maquinaId],
    queryFn: () => leiturasApi.ultima(maquinaId!),
    enabled: maquinaId !== null,
  });
}

export function useUltimasLeituras(maquinaIds: number[]) {
  return useQuery<Record<number, Leitura | null>>({
    queryKey: ['ultimas-leituras', maquinaIds],
    queryFn: async () => {
      const results = await Promise.allSettled(
        maquinaIds.map((id) => leiturasApi.ultima(id))
      );
      const map: Record<number, Leitura | null> = {};
      results.forEach((result, index) => {
        map[maquinaIds[index]] = result.status === 'fulfilled' ? result.value : null;
      });
      return map;
    },
    enabled: maquinaIds.length > 0,
  });
}

export function useLeiturasPorPeriodo(params: PeriodoParams | null) {
  return useQuery<Leitura[]>({
    queryKey: ['leituras', 'periodo', params],
    queryFn: () => {
      if ((params as any)?.maquinas) {
        return leiturasApi.buscarPorPeriodoMultiplas(params!);
      }
      return leiturasApi.buscarPorPeriodo(params!);
    },
    enabled: params !== null,
    staleTime: 0,
  });
}

export function useEstatisticas(maquinaId: number | null) {
  return useQuery<Estatisticas>({
    queryKey: ['estatisticas', maquinaId],
    queryFn: () => leiturasApi.estatisticas(maquinaId!),
    enabled: maquinaId !== null,
  });
}
