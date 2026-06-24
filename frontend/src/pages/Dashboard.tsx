import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Typography,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import { useMaquinas } from '../hooks/useMaquinas';
import { leiturasApi, controleApi } from '../services/api';
import MaquinaCard from '../components/MaquinaCard';
import type { AlertaMaquina } from '../components/MaquinaCard';
import type { Maquina, StatusControle } from '../types';

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
  const [statusMap, setStatusMap] = useState<Record<number, StatusControle>>({});

  const buscarCache = useCallback(async () => {
    try {
      const data = await leiturasApi.cache();
      setCache(data ?? {});
    } catch {}
  }, []);

  const buscarStatus = useCallback(async () => {
    if (!maquinas) return;
    const ativas = maquinas.filter((m) => m.ativo);
    const results = await Promise.allSettled(
      ativas.map((m) => controleApi.lerStatusControle(m.id))
    );
    const map: Record<number, StatusControle> = {};
    ativas.forEach((m, i) => {
      if (results[i].status === 'fulfilled') map[m.id] = results[i].value;
    });
    setStatusMap(map);
  }, [maquinas]);

  useEffect(() => {
    buscarCache();
    buscarStatus();
    const interval = setInterval(() => {
      buscarCache();
      buscarStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [buscarCache, buscarStatus]);

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
            <Grid item xs={12} sm={6} md={6} lg={6} key={maquina.id}>
              <MaquinaCard
                nome={maquina.nome}
                data={cachedEntry ?? null}
                alerta={alerta}
                offline={offline}
                ultimaAtualizacao={cachedEntry?.data_hora}
                statusControle={statusMap[maquina.id] ?? null}
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
              <Grid item xs={12} sm={6} md={6} lg={6} key={maquina.id}>
                <MaquinaCard nome={maquina.nome} data={null} />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );
}
