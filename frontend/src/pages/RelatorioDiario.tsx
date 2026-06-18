import { useState, useMemo, useEffect, useCallback } from 'react';
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
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useMaquinas } from '../hooks/useMaquinas';
import { resumoDiarioApi } from '../services/api';
import { leiturasApi } from '../services/api';

const MAQUINA_COLORS = [
  '#e53935', '#1e88e5', '#43a047', '#fb8c00',
  '#8e24aa', '#00acc1', '#d81b60', '#5e35b1',
];

function lightenColor(hex: string): string {
  return hex + '88';
}

function formatLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDefaultInicio(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return formatLocal(d);
}

function getDefaultFim(): string {
  return formatLocal(new Date());
}

const PERIODOS_DIAS = [
  { label: '7 dias', dias: 7 },
  { label: '15 dias', dias: 15 },
  { label: '30 dias', dias: 30 },
  { label: '60 dias', dias: 60 },
];

export default function RelatorioDiario() {
  const { data: maquinas, isLoading: loadingMaq } = useMaquinas();
  const [maquinaIds, setMaquinaIds] = useState<number[]>([]);
  const [dataInicio, setDataInicio] = useState(getDefaultInicio());
  const [dataFim, setDataFim] = useState(getDefaultFim());
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<any[]>([]);
  const [exportingCSV, setExportingCSV] = useState(false);

  const maquinaMap = useMemo(() => {
    const map: Record<number, string> = {};
    (maquinas ?? []).forEach((m) => { map[m.id] = m.nome; });
    return map;
  }, [maquinas]);

  const buscar = useCallback(async () => {
    if (maquinaIds.length === 0) return;
    setLoading(true);
    try {
      const params: any = {};
      if (dataInicio) params.inicio = dataInicio;
      if (dataFim) params.fim = dataFim;
      if (maquinaIds.length > 0) params.maquinas = maquinaIds.join(',');
      const result = await resumoDiarioApi.buscar(params);
      setDados(Array.isArray(result) ? result : []);
    } catch {
      setDados([]);
    } finally {
      setLoading(false);
    }
  }, [maquinaIds, dataInicio, dataFim]);

  useEffect(() => {
    if (maquinaIds.length > 0) buscar();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (maquinaIds.length > 0) buscar();
    }, 300000);
    return () => clearInterval(interval);
  }, [buscar]);

  const handlePeriodo = (dias: number) => {
    const fim = new Date();
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - dias);
    setDataInicio(formatLocal(inicio));
    setDataFim(formatLocal(fim));
  };

  const chartData = useMemo(() => {
    const grouped: Record<string, any> = {};
    dados.forEach((d: any) => {
      const key = d.data;
      if (!grouped[key]) grouped[key] = { data: key };
      const mid = d.maquina_id;
      grouped[key][`${mid}_temp_min`] = d.temp_min;
      grouped[key][`${mid}_temp_max`] = d.temp_max;
      grouped[key][`${mid}_umid_min`] = d.umid_min;
      grouped[key][`${mid}_umid_max`] = d.umid_max;
      grouped[key][`nome_${mid}`] = maquinaMap[mid] ?? `#${mid}`;
    });
    return Object.values(grouped).sort((a: any, b: any) => a.data.localeCompare(b.data));
  }, [dados, maquinaMap]);

  const handleExportCSV = async () => {
    setExportingCSV(true);
    try {
      let csv = '\xEF\xBB\xBF';
      csv += 'Data;Maquina;Temp Min;Temp Max;Umid Min;Umid Max\r\n';
      dados.forEach((d: any) => {
        csv += `${d.data};${maquinaMap[d.maquina_id] ?? '#' + d.maquina_id};${d.temp_min ?? ''};${d.temp_max ?? ''};${d.umid_min ?? ''};${d.umid_max ?? ''}\r\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coldvisio_diario_${dataInicio}_a_${dataFim}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setExportingCSV(false);
    }
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
      <Typography variant="h4" fontWeight={700} mb={3}>Relatorio Diario</Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
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
                  <MenuItem key={m.id} value={m.id}>{m.nome}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth label="Inicio" type="date" InputLabelProps={{ shrink: true }}
              value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth label="Fim" type="date" InputLabelProps={{ shrink: true }}
              value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {PERIODOS_DIAS.map((p) => (
                <Button key={p.dias} size="small" variant="outlined" onClick={() => handlePeriodo(p.dias)}>
                  {p.label}
                </Button>
              ))}
            </Box>
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button variant="contained" startIcon={<SearchIcon />} onClick={buscar}
              disabled={maquinaIds.length === 0} fullWidth>
              Buscar
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}

      {!loading && dados.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
            onClick={handleExportCSV} disabled={exportingCSV}>CSV</Button>
          <Tooltip title="Ctrl+P"><Button variant="outlined" size="small" startIcon={<PdfIcon />}
            onClick={handleExportPDF}>PDF</Button></Tooltip>
        </Box>
      )}

      {!loading && dados.length === 0 && maquinaIds.length > 0 && (
        <Alert severity="info">Nenhum dado encontrado.</Alert>
      )}

      <Box id="print-area">
        {chartData.length > 0 && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" fontWeight={600} mb={2} color="error.main">
                  Temperatura - Min / Max Diario
                </Typography>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData}>
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
                <Typography variant="h6" fontWeight={600} mb={2} color="primary.main">
                  Umidade - Min / Max Diario
                </Typography>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData}>
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
        )}

        {dados.length > 0 && (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data</TableCell>
                  <TableCell>Maquina</TableCell>
                  <TableCell align="right">Temp Min</TableCell>
                  <TableCell align="right">Temp Max</TableCell>
                  <TableCell align="right">Umid Min</TableCell>
                  <TableCell align="right">Umid Max</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dados.map((row: any, idx: number) => (
                  <TableRow key={idx} hover>
                    <TableCell>{row.data}</TableCell>
                    <TableCell>
                      <Chip label={maquinaMap[row.maquina_id] ?? `#${row.maquina_id}`} size="small"
                        sx={{ bgcolor: MAQUINA_COLORS[(row.maquina_id - 1) % MAQUINA_COLORS.length], color: '#fff' }} />
                    </TableCell>
                    <TableCell align="right">{row.temp_min != null ? `${Math.round(row.temp_min)}°C` : '--'}</TableCell>
                    <TableCell align="right">{row.temp_max != null ? `${Math.round(row.temp_max)}°C` : '--'}</TableCell>
                    <TableCell align="right">{row.umid_min != null ? `${Math.round(row.umid_min)}%` : '--'}</TableCell>
                    <TableCell align="right">{row.umid_max != null ? `${Math.round(row.umid_max)}%` : '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {maquinaIds.length === 0 && (
        <Alert severity="info">Selecione uma ou mais maquinas e clique em Buscar.</Alert>
      )}
    </Box>
  );
}
