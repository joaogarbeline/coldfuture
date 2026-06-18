import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Grid,
  Typography,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import { useMaquinas } from '../hooks/useMaquinas';
import { leiturasApi } from '../services/api';
import MaquinaCard from '../components/MaquinaCard';
import type { AlertaMaquina } from '../components/MaquinaCard';
import type { Maquina } from '../types';

interface CachedEntry {
  temperatura: number;
  umidade: number;
  data_hora: string;
  online?: boolean;
  stale?: boolean;
}

function computeAlerta(
  cache: CachedEntry | undefined,
  maquina: Maquina
): AlertaMaquina {
  if (!cache || cache.online === false) {
    return { tempMax: false, tempMin: false, umidMax: false, umidMin: false };
  }
  return {
    tempMax: maquina.setpoint_temp_max != null && cache.temperatura >= maquina.setpoint_temp_max,
    tempMin: maquina.setpoint_temp_min != null && cache.temperatura <= maquina.setpoint_temp_min,
    umidMax: maquina.setpoint_umid_max != null && cache.umidade >= maquina.setpoint_umid_max,
    umidMin: maquina.setpoint_umid_min != null && cache.umidade <= maquina.setpoint_umid_min,
  };
}

function isOffline(cache: CachedEntry | undefined): boolean {
  if (!cache) return true;
  if (cache.online === false) return true;
  if (cache.stale === true) return true;
  return false;
}

export default function Dashboard() {
  const { data: maquinas, isLoading, error } = useMaquinas();
  const [cache, setCache] = useState<Record<number, CachedEntry>>({});
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  const buscarCache = useCallback(async () => {
    try {
      const data = await leiturasApi.cache();
      setCache(data ?? {});
    } catch {}
  }, []);

  useEffect(() => {
    buscarCache();
    const interval = setInterval(buscarCache, 3000);
    return () => clearInterval(interval);
  }, [buscarCache]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Erro ao carregar maquinas.</Alert>;
  }

  const maquinasAtivas = (maquinas ?? []).filter((m) => m.ativo);
  const maquinasInativas = (maquinas ?? []).filter((m) => !m.ativo);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Dashboard</Typography>
        <Chip label="Tempo real" color="success" size="small" variant="outlined" />
      </Box>

      {maquinasAtivas.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Nenhuma maquina ativa. Cadastre na aba Configuracao.
        </Alert>
      )}

      <Grid container spacing={2}>
        {maquinasAtivas.map((maquina) => {
          const cachedEntry = cache[maquina.id];
          const offline = isOffline(cachedEntry);
          const alerta = computeAlerta(cachedEntry, maquina);
          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={maquina.id}>
              <MaquinaCard
                nome={maquina.nome}
                data={cachedEntry ?? null}
                alerta={alerta}
                offline={offline}
                ultimaAtualizacao={cachedEntry?.data_hora}
              />
            </Grid>
          );
        })}
      </Grid>

      {maquinasInativas.length > 0 && (
        <>
          <Typography variant="h6" fontWeight={600} sx={{ mt: 4, mb: 2 }}>
            Maquinas Inativas
          </Typography>
          <Grid container spacing={2}>
            {maquinasInativas.map((maquina) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={maquina.id}>
                <MaquinaCard nome={maquina.nome} data={null} />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );
}
