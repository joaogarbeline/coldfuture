import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { useMaquinas } from '../hooks/useMaquinas';
import { useLeiturasPorPeriodo } from '../hooks/useLeituras';
import type { Leitura, PeriodoParams, Maquina } from '../types';

const TIPO_ALARME_LABELS: Record<string, string> = {
  'temp_max': 'Alta Temperatura',
  'temp_min': 'Baixa Temperatura',
  'umid_max': 'Alta Umidade',
  'umid_min': 'Baixa Umidade',
};

interface AlarmeEntry {
  leitura: Leitura;
  tipos: string[];
  descricoes: string[];
}

function detectarAlarmes(leitura: Leitura, maquina?: Maquina): AlarmeEntry | null {
  if (!maquina) return null;
  const tipos: string[] = [];
  const descricoes: string[] = [];

  if (maquina.setpoint_temp_max != null && leitura.temperatura != null && leitura.temperatura >= maquina.setpoint_temp_max) {
    tipos.push('temp_max');
    descricoes.push(`Temp ${Math.round(leitura.temperatura)}°C >= max ${maquina.setpoint_temp_max}°C`);
  }
  if (maquina.setpoint_temp_min != null && leitura.temperatura != null && leitura.temperatura <= maquina.setpoint_temp_min) {
    tipos.push('temp_min');
    descricoes.push(`Temp ${Math.round(leitura.temperatura)}°C <= min ${maquina.setpoint_temp_min}°C`);
  }
  if (maquina.setpoint_umid_max != null && leitura.umidade != null && leitura.umidade >= maquina.setpoint_umid_max) {
    tipos.push('umid_max');
    descricoes.push(`Umid ${Math.round(leitura.umidade)}% >= max ${maquina.setpoint_umid_max}%`);
  }
  if (maquina.setpoint_umid_min != null && leitura.umidade != null && leitura.umidade <= maquina.setpoint_umid_min) {
    tipos.push('umid_min');
    descricoes.push(`Umid ${Math.round(leitura.umidade)}% <= min ${maquina.setpoint_umid_min}%`);
  }

  if (tipos.length === 0) return null;
  return { leitura, tipos, descricoes };
}

export default function Alarmes() {
  const { data: maquinas, isLoading: loadingMaquinas } = useMaquinas();
  const [maquinaId, setMaquinaId] = useState<number | ''>('');
  const [tipoAlarme, setTipoAlarme] = useState<string>('');
  const [pagina, setPagina] = useState(1);
  const [linhasPorPagina, setLinhasPorPagina] = useState(25);

  const params: PeriodoParams | null = useMemo(() => {
    const p: PeriodoParams = { limit: 50000 };
    if (maquinaId !== '') p.maquina = maquinaId as number;
    const fim = new Date();
    const inicio = new Date(fim);
    inicio.setHours(inicio.getHours() - 24);
    p.inicio = inicio.toISOString();
    p.fim = fim.toISOString();
    return p;
  }, [maquinaId]);

  const { data: leituras, isLoading: loadingLeituras } =
    useLeiturasPorPeriodo(params);

  const maquinaMap = useMemo(() => {
    const map: Record<number, Maquina> = {};
    (maquinas ?? []).forEach((m) => {
      map[m.id] = m;
    });
    return map;
  }, [maquinas]);

  const todosAlarmes = useMemo(() => {
    if (!leituras) return [];
    return leituras
      .map((l) => detectarAlarmes(l, maquinaMap[l.maquina_id]))
      .filter((a): a is AlarmeEntry => a !== null);
  }, [leituras, maquinaMap]);

  const filteredLeituras = useMemo(() => {
    if (tipoAlarme === '') return todosAlarmes;
    return todosAlarmes.filter((a) => a.tipos.includes(tipoAlarme));
  }, [todosAlarmes, tipoAlarme]);

  if (loadingMaquinas) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <WarningIcon color="warning" fontSize="large" />
        <Typography variant="h4" fontWeight={700}>
          Alarmes
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Maquina</InputLabel>
            <Select
              value={maquinaId}
              label="Maquina"
              onChange={(e) => setMaquinaId(e.target.value as number)}
            >
              <MenuItem value="">Todas</MenuItem>
              {(maquinas ?? []).map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Tipo de Alarme</InputLabel>
            <Select
              value={tipoAlarme}
              label="Tipo de Alarme"
              onChange={(e) => setTipoAlarme(e.target.value as string)}
            >
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(TIPO_ALARME_LABELS).map(([key, label]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {loadingLeituras && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loadingLeituras && filteredLeituras.length === 0 && (
        <Alert severity="info">Nenhum alarme encontrado nas ultimas 24 horas.</Alert>
      )}

      {filteredLeituras.length > 0 && (
        <>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Data/Hora</TableCell>
                <TableCell>Maquina</TableCell>
                <TableCell>Temperatura</TableCell>
                <TableCell>Umidade</TableCell>
                <TableCell>Alarmes Ativos</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLeituras.slice((pagina - 1) * linhasPorPagina, pagina * linhasPorPagina).map((alarme) => {
                const l = alarme.leitura;
                return (
                  <TableRow
                    key={l.id}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell>
                      {new Date(l.data_hora).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      {maquinaMap[l.maquina_id]?.nome ?? `#${l.maquina_id}`}
                    </TableCell>
                    <TableCell>
                      {l.temperatura !== null
                        ? `${Math.round(l.temperatura)}°C`
                        : '--'}
                    </TableCell>
                    <TableCell>
                      {l.umidade !== null
                        ? `${Math.round(l.umidade)}%`
                        : '--'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {alarme.descricoes.map((desc, i) => (
                          <Chip
                            key={i}
                            label={desc}
                            color="error"
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">Linhas por pagina:</Typography>
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <Select value={linhasPorPagina} onChange={(e) => { setLinhasPorPagina(e.target.value as number); setPagina(1); }}>
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
                <MenuItem value={200}>200</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button size="small" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
            <Typography variant="body2" color="text.secondary">
              Pagina {pagina} de {Math.ceil(filteredLeituras.length / linhasPorPagina)}
            </Typography>
            <Button size="small" disabled={pagina >= Math.ceil(filteredLeituras.length / linhasPorPagina)} onClick={() => setPagina((p) => p + 1)}>Proximo</Button>
          </Box>
        </Box>
        </>
      )}
    </Box>
  );
}
