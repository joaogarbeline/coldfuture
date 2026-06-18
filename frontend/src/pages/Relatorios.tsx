import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButtonGroup,
  ToggleButton,
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useMaquinas } from '../hooks/useMaquinas';
import { useLeiturasPorPeriodo } from '../hooks/useLeituras';
import { leiturasApi, resumoDiarioApi } from '../services/api';
import type { Leitura, PeriodoParams } from '../types';

const MAQUINA_COLORS = [
  '#e53935', '#1e88e5', '#43a047', '#fb8c00',
  '#8e24aa', '#00acc1', '#d81b60', '#5e35b1',
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

const PERIODOS_DIAS = [
  { label: '7 dias', dias: 7 },
  { label: '15 dias', dias: 15 },
  { label: '30 dias', dias: 30 },
  { label: '60 dias', dias: 60 },
];

const AGRUPAMENTOS = [
  { label: '1 min (sem agrupar)', value: 1 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '30 min', value: 30 },
  { label: '1 hora', value: 60 },
];

function formatLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getInicioHoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00`;
}

function getFimHoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T23:59`;
}

function getDefaultInicioDias(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return formatLocal(d);
}

function getDefaultFimDias(): string {
  return formatLocal(new Date());
}

function fmtHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function lightenColor(hex: string): string {
  return hex + '88';
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
  const buckets: Record<string, { temps: number[]; umids: number[]; maquinaId: number; nome: string }> = {};
  leituras.forEach((l) => {
    const d = new Date(l.data_hora);
    const bucketMin = Math.floor((d.getHours() * 60 + d.getMinutes()) / intervaloMin) * intervaloMin;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${bucketMin}-${l.maquina_id}`;
    if (!buckets[key]) {
      buckets[key] = { temps: [], umids: [], maquinaId: l.maquina_id, nome: maquinaMap[l.maquina_id] ?? `#${l.maquina_id}` };
    }
    if (l.temperatura != null) buckets[key].temps.push(l.temperatura);
    if (l.umidade != null) buckets[key].umids.push(l.umidade);
  });
  return Object.entries(buckets).map(([key, val]) => {
    const parts = key.split('-');
    const bucketMin = parseInt(parts[3]);
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    return {
      hora: fmtHora(bucketMin),
      nomeMaquina: val.nome,
      temperatura: avg(val.temps),
      umidade: avg(val.umids),
      maquina_id: val.maquinaId,
    };
  }).sort((a, b) => a.hora.localeCompare(b.hora) || a.maquina_id - b.maquina_id);
}

export default function Relatorios() {
  const { data: maquinas, isLoading: loadingMaq } = useMaquinas();
  const [tipoRelatorio, setTipoRelatorio] = useState<'normal' | 'diario'>('normal');
  const [maquinaIds, setMaquinaIds] = useState<number[]>([]);
  const [dataInicio, setDataInicio] = useState(getInicioHoje());
  const [dataFim, setDataFim] = useState(getFimHoje());
  const [periodo, setPeriodo] = useState('hoje');
  const [agruparPor, setAgruparPor] = useState(5);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [params, setParams] = useState<PeriodoParams | null>(null);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [linhasPorPagina, setLinhasPorPagina] = useState(25);

  const [dadosDiario, setDadosDiario] = useState<any[]>([]);
  const [loadingDiario, setLoadingDiario] = useState(false);
  const [dataInicioD, setDataInicioD] = useState(getDefaultInicioDias());
  const [dataFimD, setDataFimD] = useState(getDefaultFimDias());

  const { data: leituras, isLoading: loadingLeit } = useLeiturasPorPeriodo(params);

  const maquinaMap = useMemo(() => {
    const map: Record<number, string> = {};
    (maquinas ?? []).forEach((m) => { map[m.id] = m.nome; });
    return map;
  }, [maquinas]);

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

  const handleBuscarNormal = () => {
    if (maquinaIds.length === 0) return;
    const p: PeriodoParams = { limit: 50000 };
    if (dataInicio) p.inicio = new Date(dataInicio).toISOString();
    if (dataFim) p.fim = new Date(dataFim).toISOString();
    if (maquinaIds.length > 0) (p as any).maquinas = maquinaIds.join(',');
    (p as any)._t = Date.now();
    setParams(p);
    setPagina(1);
  };

  const handlePeriodoDias = (dias: number) => {
    const fim = new Date();
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - dias);
    setDataInicioD(formatLocal(inicio));
    setDataFimD(formatLocal(fim));
  };

  const buscarDiario = useCallback(async () => {
    if (maquinaIds.length === 0) return;
    setLoadingDiario(true);
    try {
      const p: any = {};
      if (dataInicioD) p.inicio = dataInicioD;
      if (dataFimD) p.fim = dataFimD;
      if (maquinaIds.length > 0) p.maquinas = maquinaIds.join(',');
      const result = await resumoDiarioApi.buscar(p);
      setDadosDiario(Array.isArray(result) ? result : []);
    } catch { setDadosDiario([]); }
    finally { setLoadingDiario(false); }
  }, [maquinaIds, dataInicioD, dataFimD]);

  useEffect(() => {
    if (tipoRelatorio === 'diario' && maquinaIds.length > 0) buscarDiario();
  }, [tipoRelatorio]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (tipoRelatorio === 'diario' && maquinaIds.length > 0) buscarDiario();
    }, 300000);
    return () => clearInterval(interval);
  }, [buscarDiario, tipoRelatorio]);

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
    });
    return Object.values(grouped).sort((a: any, b: any) => a.hora.localeCompare(b.hora));
  }, [dadosAgrupados]);

  const diarioChartData = useMemo(() => {
    const grouped: Record<string, any> = {};
    dadosDiario.forEach((item: any) => {
      const date = item.data || item.dia;
      if (!date || !grouped[date]) grouped[date] = { data: date };
      const mid = item.maquina_id;
      grouped[date][`${mid}_temp_min`] = item.temp_min;
      grouped[date][`${mid}_temp_max`] = item.temp_max;
      grouped[date][`${mid}_umid_min`] = item.umid_min;
      grouped[date][`${mid}_umid_max`] = item.umid_max;
    });
    return Object.values(grouped).sort((a: any, b: any) => a.data.localeCompare(b.data));
  }, [dadosDiario]);

  const handleExportCSV = async () => {
    if (tipoRelatorio === 'normal' && !params) return;
    setExportingCSV(true);
    try {
      const paramsCsv: any = {};
      if (tipoRelatorio === 'normal') {
        if (params!.inicio) paramsCsv.inicio = params!.inicio;
        if (params!.fim) paramsCsv.fim = params!.fim;
        if (maquinaIds.length === 1) paramsCsv.maquina = maquinaIds[0];
        else if (maquinaIds.length > 1) paramsCsv.maquinas = maquinaIds.join(',');
        const blob = await leiturasApi.exportarCSV(paramsCsv);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `coldvisio_relatorio_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        let csv = '\xEF\xBB\xBF';
        csv += 'Data;Maquina;Temp Min;Temp Max;Umid Min;Umid Max\r\n';
        dadosDiario.forEach((d: any) => {
          csv += `${d.data};${maquinaMap[d.maquina_id] ?? '#' + d.maquina_id};${d.temp_min ?? ''};${d.temp_max ?? ''};${d.umid_min ?? ''};${d.umid_max ?? ''}\r\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `coldvisio_diario_${dataInicioD}_a_${dataFimD}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } finally { setExportingCSV(false); }
  };

  const handleExportPDF = () => {
    const style = document.createElement('style');
    style.id = 'print-pdf';
    style.innerHTML = `@media print { body * { visibility: hidden !important; } #print-area, #print-area * { visibility: visible !important; } #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; } .MuiAppBar-root, .MuiDrawer-root { display: none !important; } }`;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => { const el = document.getElementById('print-pdf'); if (el) el.remove(); }, 500);
  };

  const selectedMaquinaIds = maquinaIds;
  const maquinasAtivas = (maquinas ?? []).filter((m) => m.ativo);

  if (loadingMaq) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4" fontWeight={700}>Relatorios</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <Select value={tipoRelatorio} onChange={(e) => setTipoRelatorio(e.target.value as 'normal' | 'diario')}>
              <MenuItem value="normal">Temperatura e Umidade</MenuItem>
              <MenuItem value="diario">Diario (Min/Max)</MenuItem>
            </Select>
          </FormControl>
          {tipoRelatorio === 'normal' && (
            <ToggleButtonGroup value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)} size="small">
              <ToggleButton value="chart"><ChartIcon /></ToggleButton>
              <ToggleButton value="table"><TableIcon /></ToggleButton>
            </ToggleButtonGroup>
          )}
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>Maquinas</InputLabel>
              <Select multiple value={selectedMaquinaIds}
                onChange={(e) => setMaquinaIds(e.target.value as number[])}
                input={<OutlinedInput label="Maquinas" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((id) => (
                      <Chip key={id} label={maquinaMap[id] ?? `#${id}`} size="small"
                        sx={{ bgcolor: MAQUINA_COLORS[(id - 1) % MAQUINA_COLORS.length], color: '#fff' }} />
                    ))}
                  </Box>
                )}>
                {maquinasAtivas.map((m) => (
                  <MenuItem key={m.id} value={m.id}>{m.nome}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {tipoRelatorio === 'normal' ? (
            <>
              <Grid item xs={12} sm={2}>
                <FormControl fullWidth>
                  <InputLabel>Periodo</InputLabel>
                  <Select value={periodo} label="Periodo" onChange={(e) => handlePeriodoChange(e.target.value)}>
                    {PERIODOS.map((p) => (<MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>))}
                  </Select>
                </FormControl>
              </Grid>
              {periodo === 'custom' && (
                <>
                  <Grid item xs={6} sm={2}>
                    <TextField fullWidth label="Inicio" type="datetime-local" InputLabelProps={{ shrink: true }}
                      value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <TextField fullWidth label="Fim" type="datetime-local" InputLabelProps={{ shrink: true }}
                      value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                  </Grid>
                </>
              )}
              <Grid item xs={6} sm={2}>
                <FormControl fullWidth>
                  <InputLabel>Agrupar por</InputLabel>
                  <Select value={agruparPor} label="Agrupar por" onChange={(e) => setAgruparPor(e.target.value as number)}>
                    {AGRUPAMENTOS.map((a) => (<MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>))}
                  </Select>
                </FormControl>
              </Grid>
            </>
          ) : (
            <>
              <Grid item xs={6} sm={2}>
                <TextField fullWidth label="Inicio" type="date" InputLabelProps={{ shrink: true }}
                  value={dataInicioD} onChange={(e) => setDataInicioD(e.target.value)} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField fullWidth label="Fim" type="date" InputLabelProps={{ shrink: true }}
                  value={dataFimD} onChange={(e) => setDataFimD(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {PERIODOS_DIAS.map((p) => (
                    <Button key={p.dias} size="small" variant="outlined" onClick={() => handlePeriodoDias(p.dias)}>{p.label}</Button>
                  ))}
                </Box>
              </Grid>
            </>
          )}

          <Grid item xs={12} sm={tipoRelatorio === 'normal' ? (periodo === 'custom' ? 3 : 3) : 2}>
            <Button variant="contained" startIcon={<SearchIcon />}
              onClick={tipoRelatorio === 'normal' ? handleBuscarNormal : buscarDiario}
              disabled={maquinaIds.length === 0} fullWidth>Buscar</Button>
          </Grid>
        </Grid>
      </Paper>

      {(tipoRelatorio === 'normal' ? (leituras && leituras.length > 0) : (dadosDiario.length > 0)) && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
            onClick={handleExportCSV} disabled={exportingCSV}>CSV</Button>
          <Tooltip title="Ctrl+P"><Button variant="outlined" size="small" startIcon={<PdfIcon />}
            onClick={handleExportPDF}>PDF</Button></Tooltip>
        </Box>
      )}

      {loadingLeit && tipoRelatorio === 'normal' && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}
      {loadingDiario && tipoRelatorio === 'diario' && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}

      {tipoRelatorio === 'normal' && leituras && leituras.length === 0 && params && <Alert severity="info">Nenhuma leitura encontrada.</Alert>}
      {tipoRelatorio === 'diario' && dadosDiario.length === 0 && maquinaIds.length > 0 && <Alert severity="info">Nenhum dado encontrado.</Alert>}

      {tipoRelatorio === 'normal' && viewMode === 'chart' && chartData.length > 0 && (
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

      {tipoRelatorio === 'normal' && viewMode === 'table' && dadosAgrupados.length > 0 && (
        <Box id="print-area">
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Data/Hora</TableCell><TableCell>Maquina</TableCell><TableCell align="right">Temperatura</TableCell><TableCell align="right">Umidade</TableCell></TableRow></TableHead>
              <TableBody>
                {dadosAgrupados.slice((pagina - 1) * linhasPorPagina, pagina * linhasPorPagina).map((row: any, idx: number) => (
                  <TableRow key={idx} hover>
                    <TableCell>{row.hora}</TableCell>
                    <TableCell><Chip label={row.nomeMaquina} size="small" sx={{ bgcolor: MAQUINA_COLORS[(row.maquina_id - 1) % MAQUINA_COLORS.length], color: '#fff' }} /></TableCell>
                    <TableCell align="right">{row.temperatura !== null ? `${Math.round(row.temperatura)}°C` : '--'}</TableCell>
                    <TableCell align="right">{row.umidade !== null ? `${Math.round(row.umidade)}%` : '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">Linhas por pagina:</Typography>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select value={linhasPorPagina} onChange={(e) => { setLinhasPorPagina(e.target.value as number); setPagina(1); }}>
                  <MenuItem value={25}>25</MenuItem><MenuItem value={50}>50</MenuItem><MenuItem value={100}>100</MenuItem><MenuItem value={200}>200</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button size="small" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
              <Typography variant="body2" color="text.secondary">Pagina {pagina} de {Math.ceil(dadosAgrupados.length / linhasPorPagina)}</Typography>
              <Button size="small" disabled={pagina >= Math.ceil(dadosAgrupados.length / linhasPorPagina)} onClick={() => setPagina((p) => p + 1)}>Proximo</Button>
            </Box>
          </Box>
        </Box>
      )}

      {tipoRelatorio === 'diario' && diarioChartData.length > 0 && (
        <Box id="print-area">
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" fontWeight={600} mb={2} color="error.main">Temperatura - Min / Max Diario</Typography>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={diarioChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <ReTooltip />
                    <Legend />
                    {selectedMaquinaIds.map((id, i) => [
                      <Bar key={`${id}_min`} dataKey={`${id}_temp_min`} name={`${maquinaMap[id]} Min`}
                        fill={lightenColor(MAQUINA_COLORS[i % MAQUINA_COLORS.length])} stackId={`t${id}`} />,
                      <Bar key={`${id}_max`} dataKey={`${id}_temp_max`} name={`${maquinaMap[id]} Max`}
                        fill={MAQUINA_COLORS[i % MAQUINA_COLORS.length]} stackId={`t${id}`} />,
                    ])}
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" fontWeight={600} mb={2} color="primary.main">Umidade - Min / Max Diario</Typography>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={diarioChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <ReTooltip />
                    <Legend />
                    {selectedMaquinaIds.map((id, i) => [
                      <Bar key={`${id}_umin`} dataKey={`${id}_umid_min`} name={`${maquinaMap[id]} Min`}
                        fill={lightenColor(MAQUINA_COLORS[(i + 2) % MAQUINA_COLORS.length])} stackId={`u${id}`} />,
                      <Bar key={`${id}_umax`} dataKey={`${id}_umid_max`} name={`${maquinaMap[id]} Max`}
                        fill={MAQUINA_COLORS[(i + 2) % MAQUINA_COLORS.length]} stackId={`u${id}`} />,
                    ])}
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Data</TableCell><TableCell>Maquina</TableCell><TableCell align="right">Temp Min</TableCell><TableCell align="right">Temp Max</TableCell><TableCell align="right">Umid Min</TableCell><TableCell align="right">Umid Max</TableCell></TableRow></TableHead>
              <TableBody>
                {dadosDiario.map((row: any, idx: number) => (
                  <TableRow key={idx} hover>
                    <TableCell>{row.data}</TableCell>
                    <TableCell><Chip label={maquinaMap[row.maquina_id] ?? `#${row.maquina_id}`} size="small" sx={{ bgcolor: MAQUINA_COLORS[(row.maquina_id - 1) % MAQUINA_COLORS.length], color: '#fff' }} /></TableCell>
                    <TableCell align="right">{row.temp_min != null ? `${Math.round(row.temp_min)}°C` : '--'}</TableCell>
                    <TableCell align="right">{row.temp_max != null ? `${Math.round(row.temp_max)}°C` : '--'}</TableCell>
                    <TableCell align="right">{row.umid_min != null ? `${Math.round(row.umid_min)}%` : '--'}</TableCell>
                    <TableCell align="right">{row.umid_max != null ? `${Math.round(row.umid_max)}%` : '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {maquinaIds.length === 0 && <Alert severity="info">Selecione uma ou mais maquinas e clique em Buscar.</Alert>}
    </Box>
  );
}
