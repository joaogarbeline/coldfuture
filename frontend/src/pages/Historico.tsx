import { useState, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  TextField,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  TableChart as TableIcon,
  BarChart as ChartIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useMaquinas } from '../hooks/useMaquinas';
import { useLeiturasPorPeriodo } from '../hooks/useLeituras';
import { leiturasApi } from '../services/api';
import type { Leitura, PeriodoParams } from '../types';

const MAQUINA_COLORS = [
  '#e53935', '#1e88e5', '#43a047', '#fb8c00',
  '#8e24aa', '#00acc1', '#d81b60', '#5e35b1',
  '#00897b', '#ef6c00',
];

const PERIODOS: { label: string; value: string }[] = [
  { label: 'Hoje', value: 'hoje' },
  { label: 'Ultimos 5 min', value: '5' },
  { label: 'Ultimos 10 min', value: '10' },
  { label: 'Ultimos 30 min', value: '30' },
  { label: 'Ultima 1 hora', value: '60' },
  { label: 'Ultimas 24 horas', value: '1440' },
  { label: 'Personalizado', value: 'custom' },
];

const AGRUPAMENTOS: { label: string; value: number }[] = [
  { label: '1 min (sem agrupar)', value: 1 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '30 min', value: 30 },
  { label: '1 hora', value: 60 },
];

function getInicioHoje(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}T00:00`;
}

function getFimHoje(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}T23:59`;
}

function formatDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

function fmtHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function agruparLeituras(leituras: Leitura[], intervaloMin: number, maquinaMap: Record<number, string>) {
  if (intervaloMin <= 1) {
    return leituras.map((l) => ({
      hora: new Date(l.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      nomeMaquina: maquinaMap[l.maquina_id] ?? `#${l.maquina_id}`,
      temperatura: l.temperatura,
      umidade: l.umidade,
      maquina_id: l.maquina_id,
      id: l.id,
      data_hora: l.data_hora,
    }));
  }

  const buckets: Record<string, { temps: number[]; umids: number[]; maquinaId: number; nome: string; ultimaData: string }> = {};

  leituras.forEach((l) => {
    const d = new Date(l.data_hora);
    const bucketMin = Math.floor((d.getHours() * 60 + d.getMinutes()) / intervaloMin) * intervaloMin;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${bucketMin}-${l.maquina_id}`;
    if (!buckets[key]) {
      buckets[key] = { temps: [], umids: [], maquinaId: l.maquina_id, nome: maquinaMap[l.maquina_id] ?? `#${l.maquina_id}`, ultimaData: l.data_hora };
    }
    if (l.temperatura != null) buckets[key].temps.push(l.temperatura);
    if (l.umidade != null) buckets[key].umids.push(l.umidade);
    buckets[key].ultimaData = l.data_hora;
  });

  return Object.entries(buckets)
    .map(([key, val]) => {
      const parts = key.split('-');
      const bucketMin = parseInt(parts[3]);
      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      return {
        hora: fmtHora(bucketMin),
        nomeMaquina: val.nome,
        temperatura: avg(val.temps),
        umidade: avg(val.umids),
        maquina_id: val.maquinaId,
        data_hora: val.ultimaData,
      };
    })
    .sort((a, b) => a.hora.localeCompare(b.hora) || a.maquina_id - b.maquina_id);
}

export default function Historico() {
  const { data: maquinas, isLoading: loadingMaq } = useMaquinas();
  const [maquinaIds, setMaquinaIds] = useState<number[]>([]);
  const [dataInicio, setDataInicio] = useState(getInicioHoje());
  const [dataFim, setDataFim] = useState(getFimHoje());
  const [periodo, setPeriodo] = useState('hoje');
  const [agruparPor, setAgruparPor] = useState(5);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [params, setParams] = useState<PeriodoParams | null>(null);
  const [fetchId, setFetchId] = useState(0);
  const [exportingCSV, setExportingCSV] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const { data: leituras, isLoading: loadingLeit } = useLeiturasPorPeriodo(params);

  const handlePeriodoChange = (val: string) => {
    setPeriodo(val);
    if (val === 'hoje') {
      setDataInicio(getInicioHoje());
      setDataFim(getFimHoje());
    } else if (val !== 'custom') {
      const minutos = parseInt(val);
      const fim = new Date();
      const y = fim.getFullYear();
      const m = String(fim.getMonth() + 1).padStart(2, '0');
      const d = String(fim.getDate()).padStart(2, '0');
      const h = String(fim.getHours()).padStart(2, '0');
      const min = String(fim.getMinutes()).padStart(2, '0');
      const inicio = new Date(fim.getTime() - minutos * 60 * 1000);
      const iy = inicio.getFullYear();
      const im = String(inicio.getMonth() + 1).padStart(2, '0');
      const id = String(inicio.getDate()).padStart(2, '0');
      const ih = String(inicio.getHours()).padStart(2, '0');
      const imin = String(inicio.getMinutes()).padStart(2, '0');
      setDataInicio(`${iy}-${im}-${id}T${ih}:${imin}`);
      setDataFim(`${y}-${m}-${d}T${h}:${min}`);
    }
  };

  const handleBuscar = () => {
    if (maquinaIds.length === 0) return;
    const p: PeriodoParams = { limit: 50000 };
    if (dataInicio) p.inicio = new Date(dataInicio).toISOString();
    if (dataFim) p.fim = new Date(dataFim).toISOString();
    if (maquinaIds.length > 0) (p as any).maquinas = maquinaIds.join(',');
    (p as any)._t = Date.now();
    setParams(p);
    setFetchId((n) => n + 1);
  };

  const maquinaMap = useMemo(() => {
    const map: Record<number, string> = {};
    (maquinas ?? []).forEach((m) => { map[m.id] = m.nome; });
    return map;
  }, [maquinas]);

  const dadosAgrupados = useMemo(() => {
    if (!leituras) return [];
    return agruparLeituras(leituras, agruparPor, maquinaMap);
  }, [leituras, agruparPor, maquinaMap]);

  const chartData = useMemo(() => {
    const grouped: Record<string, any> = {};
    dadosAgrupados.forEach((l) => {
      const key = `${l.hora}`;
      if (!grouped[key]) grouped[key] = { hora: l.hora };
      const mid = (l as any).maquina_id ?? 0;
      grouped[key][`temp_${mid}`] = l.temperatura;
      grouped[key][`umid_${mid}`] = l.umidade;
      grouped[key][`nome_${mid}`] = l.nomeMaquina;
    });
    return Object.values(grouped).sort((a: any, b: any) => a.hora.localeCompare(b.hora));
  }, [dadosAgrupados]);

  const handleExportCSV = async () => {
    if (!params) return;
    setExportingCSV(true);
    try {
      const paramsCsv: any = { limit: 50000 };
      if (params.inicio) paramsCsv.inicio = params.inicio;
      if (params.fim) paramsCsv.fim = params.fim;
      if (maquinaIds.length === 1) {
        paramsCsv.maquina = maquinaIds[0];
      } else if (maquinaIds.length > 1) {
        paramsCsv.maquinas = maquinaIds.join(',');
      }
      const blob = await leiturasApi.exportarCSV(paramsCsv);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coldvisio_historico_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
    } finally {
      setExportingCSV(false);
    }
  };

  const handleExportPDF = () => {
    const printStyles = document.createElement('style');
    printStyles.id = 'print-pdf-styles';
    printStyles.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #print-area, #print-area * { visibility: visible !important; }
        #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
        .MuiAppBar-root, .MuiDrawer-root, .MuiToggleButtonGroup-root { display: none !important; }
      }
    `;
    document.head.appendChild(printStyles);
    window.print();
    setTimeout(() => {
      const el = document.getElementById('print-pdf-styles');
      if (el) el.remove();
    }, 500);
  };

  const selectedMaquinaIds = maquinaIds.length > 0 ? maquinaIds : [];
  const maquinasAtivas = (maquinas ?? []).filter((m) => m.ativo);

  if (loadingMaq) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Historico</Typography>
        <ToggleButtonGroup value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)} size="small">
          <ToggleButton value="chart"><ChartIcon /></ToggleButton>
          <ToggleButton value="table"><TableIcon /></ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Maquinas</InputLabel>
              <Select
                multiple
                value={selectedMaquinaIds}
                onChange={(e) => setMaquinaIds(e.target.value as number[])}
                input={<OutlinedInput label="Maquinas" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((id) => (
                      <Chip key={id} label={maquinaMap[id] ?? `#${id}`} size="small"
                        sx={{ bgcolor: MAQUINA_COLORS[(id - 1) % MAQUINA_COLORS.length], color: '#fff' }} />
                    ))}
                  </Box>
                )}
              >
                {maquinasAtivas.map((m) => (
                  <MenuItem key={m.id} value={m.id}>{m.nome} (#{m.endereco_modbus})</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Periodo</InputLabel>
              <Select value={periodo} label="Periodo" onChange={(e) => handlePeriodoChange(e.target.value)}>
                {PERIODOS.map((p) => (
                  <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {periodo === 'custom' && (
            <>
              <Grid item xs={6} md={2}>
                <TextField fullWidth label="Inicio" type="datetime-local" InputLabelProps={{ shrink: true }}
                  value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField fullWidth label="Fim" type="datetime-local" InputLabelProps={{ shrink: true }}
                  value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </Grid>
            </>
          )}

          <Grid item xs={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Agrupar por</InputLabel>
              <Select value={agruparPor} label="Agrupar por" onChange={(e) => setAgruparPor(e.target.value as number)}>
                {AGRUPAMENTOS.map((a) => (
                  <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6} md={periodo === 'custom' ? 3 : 3}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" startIcon={<SearchIcon />} onClick={handleBuscar}
                disabled={maquinaIds.length === 0} fullWidth>
                Buscar
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {leituras && leituras.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
            onClick={handleExportCSV} disabled={exportingCSV}>
            {exportingCSV ? 'Exportando...' : 'CSV'}
          </Button>
          <Tooltip title="Use Ctrl+P para PDF"><Button variant="outlined" size="small" startIcon={<PdfIcon />}
            onClick={handleExportPDF}>PDF</Button></Tooltip>
        </Box>
      )}

      {loadingLeit && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
      )}

      {leituras && leituras.length === 0 && params && (
        <Alert severity="info">Nenhuma leitura encontrada para o periodo selecionado.</Alert>
      )}

      {viewMode === 'chart' && chartData.length > 0 && (
        <Box id="print-area">
          <Grid container spacing={3}>
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" fontWeight={600} mb={2} color="error.main">Temperatura (°C)</Typography>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <ReTooltip />
                    <Legend />
                    {selectedMaquinaIds.map((id, i) => (
                      <Line key={id} type="monotone" dataKey={`temp_${id}`} stroke={MAQUINA_COLORS[i % MAQUINA_COLORS.length]}
                        strokeWidth={2} dot={false} name={`${maquinaMap[id] ?? `#${id}`} °C`} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" fontWeight={600} mb={2} color="primary.main">Umidade (%)</Typography>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <ReTooltip />
                    <Legend />
                    {selectedMaquinaIds.map((id, i) => (
                      <Line key={id} type="monotone" dataKey={`umid_${id}`} stroke={MAQUINA_COLORS[i % MAQUINA_COLORS.length]}
                        strokeWidth={2} dot={false} name={`${maquinaMap[id] ?? `#${id}`} %`} connectNulls
                        strokeDasharray={i % 2 === 0 ? '' : '5 5'} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {viewMode === 'table' && dadosAgrupados.length > 0 && (
        <Box id="print-area">
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data/Hora</TableCell>
                  <TableCell>Maquina</TableCell>
                  <TableCell align="right">Temperatura</TableCell>
                  <TableCell align="right">Umidade</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dadosAgrupados.map((row: any, idx: number) => (
                  <TableRow key={idx} hover>
                    <TableCell>{row.hora}</TableCell>
                    <TableCell>
                      <Chip label={row.nomeMaquina} size="small"
                        sx={{ bgcolor: MAQUINA_COLORS[(row.maquina_id - 1) % MAQUINA_COLORS.length], color: '#fff' }} />
                    </TableCell>
                    <TableCell align="right">{row.temperatura !== null ? `${Math.round(row.temperatura)}°C` : '--'}</TableCell>
                    <TableCell align="right">{row.umidade !== null ? `${Math.round(row.umidade)}%` : '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {!params && maquinasAtivas.length > 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Selecione uma ou mais maquinas, o periodo e clique em Buscar.
        </Alert>
      )}
    </Box>
  );
}
