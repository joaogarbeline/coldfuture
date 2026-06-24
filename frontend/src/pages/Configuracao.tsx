import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Tune as TuneIcon,
  Search as DiscoverIcon,
  Cable as CableIcon,
} from '@mui/icons-material';
import { useMaquinas } from '../hooks/useMaquinas';
import { maquinasApi, configApi } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import type { Maquina } from '../types';

export default function Configuracao() {
  const queryClient = useQueryClient();
  const { data: maquinas, isLoading, error } = useMaquinas();

  const [openDialog, setOpenDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const [openSetpoints, setOpenSetpoints] = useState(false);
  const [spMaquinaId, setSpMaquinaId] = useState<number | null>(null);
  const [spMaquinaNome, setSpMaquinaNome] = useState('');
  const [spTempMax, setSpTempMax] = useState('');
  const [spTempMin, setSpTempMin] = useState('');
  const [spUmidMax, setSpUmidMax] = useState('');
  const [spUmidMin, setSpUmidMin] = useState('');
  const [savingSp, setSavingSp] = useState(false);

  const [discovering, setDiscovering] = useState(false);
  const [discoveredAddrs, setDiscoveredAddrs] = useState<number[]>([]);

  const [openModbus, setOpenModbus] = useState(false);
  const [modbusModo, setModbusModo] = useState('rtu');
  const [modbusPorta, setModbusPorta] = useState('COM4');
  const [modbusBaudrate, setModbusBaudrate] = useState('9600');
  const [modbusParity, setModbusParity] = useState('N');
  const [modbusStopbits, setModbusStopbits] = useState('1');
  const [modbusTCPHost, setModbusTCPHost] = useState('192.168.1.100');
  const [modbusTCPPort, setModbusTCPPort] = useState('502');
  const [modbusTimeout, setModbusTimeout] = useState('2');
  const [savingModbus, setSavingModbus] = useState(false);
  const [carregandoModbus, setCarregandoModbus] = useState(false);

  const carregarConfigModbus = async () => {
    setCarregandoModbus(true);
    try {
      const c = await configApi.buscar();
      if (c) {
        setModbusModo(c.modbus_modo ?? 'rtu');
        setModbusPorta(c.modbus_porta ?? 'COM4');
        setModbusBaudrate(String(c.modbus_baudrate ?? 9600));
        setModbusParity(c.modbus_parity ?? 'N');
        setModbusStopbits(String(c.modbus_stopbits ?? 1));
        setModbusTCPHost(c.modbus_tcp_host ?? '192.168.1.100');
        setModbusTCPPort(String(c.modbus_tcp_port ?? 502));
        setModbusTimeout(String(c.modbus_timeout ?? 2));
      }
    } catch {
    } finally {
      setCarregandoModbus(false);
    }
  };

  const abrirConfigModbus = async () => {
    setOpenModbus(true);
    await carregarConfigModbus();
  };

  const handleSalvarModbus = async () => {
    setSavingModbus(true);
    setMsg(null);
    try {
      const payload = {
        modbus_modo: modbusModo,
        modbus_porta: modbusPorta,
        modbus_baudrate: parseInt(modbusBaudrate) || 9600,
        modbus_parity: modbusParity,
        modbus_stopbits: parseInt(modbusStopbits) || 1,
        modbus_tcp_host: modbusTCPHost,
        modbus_tcp_port: parseInt(modbusTCPPort) || 502,
        modbus_timeout: parseInt(modbusTimeout) || 2,
      };
      await configApi.salvarModbus(payload);
      setMsg({ tipo: 'success', texto: 'Configuracao Modbus salva! Reinicie o servidor para aplicar.' });
      setOpenModbus(false);
    } catch (err: any) {
      setMsg({
        tipo: 'error',
        texto: err?.response?.data?.error ?? 'Erro ao salvar configuracao.',
      });
    } finally {
      setSavingModbus(false);
    }
  };

  const abrirCriar = () => {
    setEditMode(false);
    setEditId(null);
    setNome('');
    setEndereco('');
    setAtivo(true);
    setOpenDialog(true);
  };

  const abrirEditar = (maquina: Maquina) => {
    setEditMode(true);
    setEditId(maquina.id);
    setNome(maquina.nome);
    setEndereco(maquina.endereco_modbus.toString());
    setAtivo(maquina.ativo);
    setOpenDialog(true);
  };

  const abrirSetpoints = (maquina: Maquina) => {
    setSpMaquinaId(maquina.id);
    setSpMaquinaNome(maquina.nome);
    setSpTempMax(maquina.setpoint_temp_max?.toString() ?? '');
    setSpTempMin(maquina.setpoint_temp_min?.toString() ?? '');
    setSpUmidMax(maquina.setpoint_umid_max?.toString() ?? '');
    setSpUmidMin(maquina.setpoint_umid_min?.toString() ?? '');
    setOpenSetpoints(true);
  };

  const handleSalvar = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const payload: any = {
        nome,
        endereco_modbus: parseInt(endereco),
        ativo,
      };
      if (editMode && editId !== null) {
        await maquinasApi.atualizar(editId, payload);
        setMsg({ tipo: 'success', texto: 'Maquina atualizada com sucesso.' });
      } else {
        await maquinasApi.criar(payload);
        setMsg({ tipo: 'success', texto: 'Maquina criada com sucesso.' });
      }
      queryClient.invalidateQueries({ queryKey: ['maquinas'] });
      setOpenDialog(false);
    } catch (err: any) {
      setMsg({
        tipo: 'error',
        texto: err?.response?.data?.error ?? 'Erro ao salvar maquina.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSalvarSetpoints = async () => {
    if (spMaquinaId === null) return;
    setSavingSp(true);
    setMsg(null);
    try {
      const payload: any = {};
      if (spTempMax !== '') payload.setpoint_temp_max = parseFloat(spTempMax);
      if (spTempMin !== '') payload.setpoint_temp_min = parseFloat(spTempMin);
      if (spUmidMax !== '') payload.setpoint_umid_max = parseFloat(spUmidMax);
      if (spUmidMin !== '') payload.setpoint_umid_min = parseFloat(spUmidMin);
      await maquinasApi.atualizarSetpoints(spMaquinaId, payload);
      queryClient.invalidateQueries({ queryKey: ['maquinas'] });
      setMsg({ tipo: 'success', texto: 'Setpoints atualizados com sucesso.' });
      setOpenSetpoints(false);
    } catch (err: any) {
      setMsg({
        tipo: 'error',
        texto: err?.response?.data?.error ?? 'Erro ao salvar setpoints.',
      });
    } finally {
      setSavingSp(false);
    }
  };

  const handleRemover = async (id: number) => {
    if (!confirm('Tem certeza que deseja remover esta maquina?')) return;
    try {
      await maquinasApi.remover(id);
      queryClient.invalidateQueries({ queryKey: ['maquinas'] });
      setMsg({ tipo: 'success', texto: 'Maquina removida com sucesso.' });
    } catch (err: any) {
      setMsg({
        tipo: 'error',
        texto: err?.response?.data?.error ?? 'Erro ao remover maquina.',
      });
    }
  };

  const handleDescobrir = async () => {
    setDiscovering(true);
    setMsg(null);
    try {
      const resultado = await maquinasApi.descobrir();
      if (resultado?.enderecos?.length > 0) {
        setDiscoveredAddrs(resultado.enderecos);
        setMsg({ tipo: 'success', texto: `${resultado.enderecos.length} controlador(es) encontrado(s)!` });
      } else {
        setDiscoveredAddrs([]);
        setMsg({ tipo: 'error', texto: 'Nenhum controlador encontrado.' });
      }
    } catch (err: any) {
      setMsg({
        tipo: 'error',
        texto: err?.response?.data?.error ?? 'Erro ao buscar controladores.',
      });
    } finally {
      setDiscovering(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Erro ao carregar maquinas: {error.message}</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Configuracao</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<CableIcon />}
            onClick={abrirConfigModbus}
          >
            Conexao Modbus
          </Button>
          <Button
            variant="outlined"
            startIcon={discovering ? <CircularProgress size={18} /> : <DiscoverIcon />}
            onClick={handleDescobrir}
            disabled={discovering}
          >
            Descobrir Controladores
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={abrirCriar}>
            Nova Maquina
          </Button>
        </Box>
      </Box>

      {msg && (
        <Alert severity={msg.tipo} sx={{ mb: 2 }} onClose={() => setMsg(null)}>
          {msg.texto}
        </Alert>
      )}

      {discoveredAddrs.length > 0 && (
        <Paper sx={{ mb: 3, p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} mb={1}>
            Controladores Encontrados na Rede Modbus
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {discoveredAddrs.map((addr) => (
              <Chip
                key={addr}
                label={`Endereco ${addr}`}
                color="success"
                onClick={() => {
                  setEndereco(addr.toString());
                  setNome(`Controlador #${addr}`);
                  abrirCriar();
                }}
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Clique em um endereco para cadastrar rapidamente.
          </Typography>
        </Paper>
      )}

      <Paper sx={{ mb: 3, p: 2 }}>
        <Typography variant="h6" fontWeight={600} mb={1}>
          Maquinas Cadastradas
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Cadastre as maquinas com o endereco Modbus (Slave ID). Configure os setpoints
          de alarme para cada maquina individualmente.
        </Typography>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nome</TableCell>
                <TableCell>Endereco</TableCell>
                <TableCell>Setpoints</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Acoes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(maquinas ?? []).map((maquina) => (
                <TableRow key={maquina.id}>
                  <TableCell>{maquina.id}</TableCell>
                  <TableCell>{maquina.nome}</TableCell>
                  <TableCell>{maquina.endereco_modbus}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {maquina.setpoint_temp_max != null && (
                        <Chip label={`T<${maquina.setpoint_temp_max}°C`} size="small" color="error" variant="outlined" />
                      )}
                      {maquina.setpoint_temp_min != null && (
                        <Chip label={`T>${maquina.setpoint_temp_min}°C`} size="small" color="info" variant="outlined" />
                      )}
                      {maquina.setpoint_umid_max != null && (
                        <Chip label={`U<${maquina.setpoint_umid_max}%`} size="small" color="warning" variant="outlined" />
                      )}
                      {maquina.setpoint_umid_min != null && (
                        <Chip label={`U>${maquina.setpoint_umid_min}%`} size="small" color="primary" variant="outlined" />
                      )}
                      {maquina.setpoint_temp_max == null && maquina.setpoint_temp_min == null &&
                       maquina.setpoint_umid_max == null && maquina.setpoint_umid_min == null && (
                        <Typography variant="caption" color="text.secondary">Nao configurado</Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={maquina.ativo ? 'Ativo' : 'Inativo'}
                      color={maquina.ativo ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton color="secondary" size="small" onClick={() => abrirSetpoints(maquina)} title="Setpoints">
                      <TuneIcon />
                    </IconButton>
                    <IconButton color="primary" size="small" onClick={() => abrirEditar(maquina)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton color="error" size="small" onClick={() => handleRemover(maquina.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {(maquinas ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    Nenhuma maquina cadastrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" fontWeight={600} mb={1}>
          Informacoes do Sistema
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={3}>
            <Typography variant="body2" color="text.secondary">Versao: 2.0.0</Typography>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Typography variant="body2" color="text.secondary">Controlador: XH260V</Typography>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Typography variant="body2" color="text.secondary">
              Comunicacao: Modbus RTU / RS485
            </Typography>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Typography variant="body2" color="text.secondary">Paridade: 8N1 / 9600 baud</Typography>
          </Grid>
        </Grid>
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editMode ? 'Editar Maquina' : 'Nova Maquina'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Endereco Modbus (Slave ID)"
              type="number"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              fullWidth
              required
              inputProps={{ min: 1, max: 247 }}
              helperText="Valor entre 1 e 247"
            />
            <FormControlLabel
              control={<Switch checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />}
              label="Ativo"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSalvar} disabled={saving || !nome || !endereco}>
            {saving ? <CircularProgress size={20} /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openSetpoints} onClose={() => setOpenSetpoints(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Setpoints de Alarme - {spMaquinaNome}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Configure os limites para geracao de alarmes. Deixe em branco para desabilitar.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="Temp. Maxima (°C)"
                type="number"
                value={spTempMax}
                onChange={(e) => setSpTempMax(e.target.value)}
                fullWidth
                helperText="Alarme se temperatura > este valor"
                inputProps={{ step: 0.1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Temp. Minima (°C)"
                type="number"
                value={spTempMin}
                onChange={(e) => setSpTempMin(e.target.value)}
                fullWidth
                helperText="Alarme se temperatura < este valor"
                inputProps={{ step: 0.1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Umid. Maxima (%)"
                type="number"
                value={spUmidMax}
                onChange={(e) => setSpUmidMax(e.target.value)}
                fullWidth
                helperText="Alarme se umidade > este valor"
                inputProps={{ step: 0.1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Umid. Minima (%)"
                type="number"
                value={spUmidMin}
                onChange={(e) => setSpUmidMin(e.target.value)}
                fullWidth
                helperText="Alarme se umidade < este valor"
                inputProps={{ step: 0.1 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSetpoints(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSalvarSetpoints} disabled={savingSp}>
            {savingSp ? <CircularProgress size={20} /> : 'Salvar Setpoints'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openModbus} onClose={() => setOpenModbus(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Conexao Modbus (RTU / TCP)</DialogTitle>
        <DialogContent>
          {carregandoModbus ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Modo de Conexao</InputLabel>
                <Select
                  value={modbusModo}
                  label="Modo de Conexao"
                  onChange={(e) => setModbusModo(e.target.value)}
                >
                  <MenuItem value="rtu">RTU (Serial / RS485 / USB-RS485)</MenuItem>
                  <MenuItem value="tcp">TCP/IP (Modbus Gateway / Ethernet)</MenuItem>
                </Select>
              </FormControl>

              {modbusModo === 'rtu' && (
                <>
                  <TextField
                    label="Porta Serial (ex: COM3, COM4, /dev/ttyUSB0)"
                    value={modbusPorta}
                    onChange={(e) => setModbusPorta(e.target.value)}
                    fullWidth
                    required
                  />
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField
                        label="Baudrate"
                        type="number"
                        value={modbusBaudrate}
                        onChange={(e) => setModbusBaudrate(e.target.value)}
                        fullWidth
                        inputProps={{ min: 1200, max: 115200 }}
                      />
                    </Grid>
                    <Grid item xs={3}>
                      <FormControl fullWidth>
                        <InputLabel>Parity</InputLabel>
                        <Select
                          value={modbusParity}
                          label="Parity"
                          onChange={(e) => setModbusParity(e.target.value)}
                        >
                          <MenuItem value="N">N (None)</MenuItem>
                          <MenuItem value="E">E (Even)</MenuItem>
                          <MenuItem value="O">O (Odd)</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={3}>
                      <FormControl fullWidth>
                        <InputLabel>Stop Bits</InputLabel>
                        <Select
                          value={modbusStopbits}
                          label="Stop Bits"
                          onChange={(e) => setModbusStopbits(e.target.value)}
                        >
                          <MenuItem value="1">1</MenuItem>
                          <MenuItem value="2">2</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </>
              )}

              {modbusModo === 'tcp' && (
                <Grid container spacing={2}>
                  <Grid item xs={8}>
                    <TextField
                      label="IP do Modbus Gateway"
                      value={modbusTCPHost}
                      onChange={(e) => setModbusTCPHost(e.target.value)}
                      fullWidth
                      required
                      placeholder="192.168.1.100"
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      label="Porta TCP"
                      type="number"
                      value={modbusTCPPort}
                      onChange={(e) => setModbusTCPPort(e.target.value)}
                      fullWidth
                      required
                      inputProps={{ min: 1, max: 65535 }}
                    />
                  </Grid>
                </Grid>
              )}

              <TextField
                label="Timeout (segundos)"
                type="number"
                value={modbusTimeout}
                onChange={(e) => setModbusTimeout(e.target.value)}
                fullWidth
                inputProps={{ min: 1, max: 30 }}
                helperText="Tempo limite de espera por resposta"
              />

              <Alert severity="warning" sx={{ mt: 1 }}>
                Apos salvar, reinicie o servidor (server.exe) para que as alteracoes tenham efeito.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenModbus(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSalvarModbus} disabled={savingModbus}>
            {savingModbus ? <CircularProgress size={20} /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
