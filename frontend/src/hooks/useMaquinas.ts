import { useQuery } from '@tanstack/react-query';
import { maquinasApi } from '../services/api';
import type { Maquina } from '../types';

export function useMaquinas() {
  return useQuery<Maquina[]>({
    queryKey: ['maquinas'],
    queryFn: () => maquinasApi.listar(),
    staleTime: 30000,
  });
}
