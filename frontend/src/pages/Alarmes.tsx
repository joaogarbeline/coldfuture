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
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { useMaquinas } from '../hooks/useMaquinas';
import { useLeiturasPorPeriodo } from '../hooks/useLeituras';
import type { Leitura, PeriodoParams, Maquina } from '../types';

const ALARME_LABELS: Record<number, string> = {
  1: 'Alta Temperatura',
  2: 'Baixa Temperatura',
  4: 'Alta Umidade',
  8: 'Falha de Comunicacao',
  16: 'Sensor com Defeito',
};

function getAlarmesAtivos(alarmes: number): { codigo: number; descricao: string }[] {
  const ativos: { codigo: number; descricao: string }[] = [];
  Object.entries(ALARME_LABELS).forEach(([codigo, descricao]) => {
    if (alarmes & parseInt(codigo)) {
      ativos.push({ codigo: parseInt(codigo), descricao });
    }
  });
  return ativos;
}

export default function Alarmes() {
  const { data: maquinas, isLoading: loadingMaquinas } = useMaquinas();
  const [maquinaId, setMaquinaId] = useState<number | ''>('');
  const [tipoAlarme, setTipoAlarme] = useState<number | ''>('');

  const params: PeriodoParams | null = useMemo(() => {
    const p: PeriodoParams = { limit: 500 };
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

  const leiturasComAlarme = useMemo(() => {
    if (!leituras) return [];
    return leituras.filter((l) => l.alarmes !== null && l.alarmes > 0);
  }, [leituras]);

  const filteredLeituras = useMemo(() => {
    if (tipoAlarme === '') return leiturasComAlarme;
    return leiturasComAlarme.filter((l) => (l.alarmes! & (tipoAlarme as number)) !== 0);
  }, [leiturasComAlarme, tipoAlarme]);

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
              onChange={(e) => setTipoAlarme(e.target.value as number)}
            >
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(ALARME_LABELS).map(([codigo, descricao]) => (
                <MenuItem key={codigo} value={parseInt(codigo)}>
                  {descricao}
                </MenuItem>
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
              {filteredLeituras.map((leitura) => {
                const alarmes = getAlarmesAtivos(leitura.alarmes ?? 0);
                return (
                  <TableRow
                    key={leitura.id}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell>
                      {new Date(leitura.data_hora).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      {maquinaMap[leitura.maquina_id]?.nome ?? `#${leitura.maquina_id}`}
                    </TableCell>
                    <TableCell>
                      {leitura.temperatura !== null
                        ? `${Math.round(leitura.temperatura)}°C`
                        : '--'}
                    </TableCell>
                    <TableCell>
                      {leitura.umidade !== null
                        ? `${Math.round(leitura.umidade)}%`
                        : '--'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {alarmes.map((a) => (
                          <Chip
                            key={a.codigo}
                            label={a.descricao}
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
      )}
    </Box>
  );
}
