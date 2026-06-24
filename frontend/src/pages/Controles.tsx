import { useState } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  Alert,
  Snackbar,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import { useMaquinas } from '../hooks/useMaquinas';
import {
  useStatusControle,
  useEnviarComando,
  useAlterarSetpoint,
  useHistoricoComandos,
} from '../hooks/useControles';
import ControleRelayCard, { relayDefinitions } from '../components/ControleRelayCard';
import SetpointEditor from '../components/SetpointEditor';
import type { StatusControle } from '../types';

export default function Controles() {
  const { data: maquinas, isLoading: loadingMaquinas } = useMaquinas();
  const [maquinaId, setMaquinaId] = useState<number | ''>('');
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false,
    msg: '',
    severity: 'success',
  });

  const { data: status, isLoading: loadingStatus } = useStatusControle(
    maquinaId !== '' ? (maquinaId as number) : null
  );

  const { data: comandos } = useHistoricoComandos(
    maquinaId !== '' ? (maquinaId as number) : null
  );

  const enviarComandoMutation = useEnviarComando();
  const alterarSetpointMutation = useAlterarSetpoint();

  const getRelayStatus = (key: string, status: StatusControle | undefined): boolean => {
    if (!status) return false;
    const map: Record<string, boolean> = {
      liga_desliga: status.ligado,
      degelo: status.degelo,
      refrigeracao: status.refrigeracao,
      ventilacao: status.ventilacao,
      desumidificacao: status.desumidificacao,
    };
    return map[key] ?? false;
  };

  const handleToggle = async (key: string, value: boolean) => {
    if (maquinaId === '') return;
    try {
      const result = await enviarComandoMutation.mutateAsync({
        maquinaId: maquinaId as number,
        data: { tipo: key, valor: value ? 'on' : 'off' },
      });
      setSnack({
        open: true,
        msg: result.sucesso ? `Comando ${key}=${value ? 'ON' : 'OFF'} enviado!` : `Erro: ${result.mensagem}`,
        severity: result.sucesso ? 'success' : 'error',
      });
    } catch {
      setSnack({ open: true, msg: 'Erro ao enviar comando', severity: 'error' });
    }
  };

  const handlePulse = async (key: string) => {
    if (maquinaId === '') return;
    try {
      const result = await enviarComandoMutation.mutateAsync({
        maquinaId: maquinaId as number,
        data: { tipo: key, valor: 'pulse' },
      });
      setSnack({
        open: true,
        msg: result.sucesso ? `Comando ${key} acionado!` : `Erro: ${result.mensagem}`,
        severity: result.sucesso ? 'success' : 'error',
      });
    } catch {
      setSnack({ open: true, msg: 'Erro ao enviar comando', severity: 'error' });
    }
  };

  const handleSalvarSetpoint = async (tipo: 'temperatura' | 'umidade', valor: number) => {
    if (maquinaId === '') return;
    try {
      const result = await alterarSetpointMutation.mutateAsync({
        maquinaId: maquinaId as number,
        data: { tipo, valor },
      });
      setSnack({
        open: true,
        msg: result.sucesso ? `Setpoint de ${tipo} alterado para ${valor}!` : `Erro: ${result.mensagem}`,
        severity: result.sucesso ? 'success' : 'error',
      });
    } catch {
      setSnack({ open: true, msg: 'Erro ao alterar setpoint', severity: 'error' });
    }
  };

  if (loadingMaquinas) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={3}>
        Controles
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl sx={{ minWidth: 280 }}>
          <InputLabel>Selecionar Maquina</InputLabel>
          <Select
            value={maquinaId}
            label="Selecionar Maquina"
            onChange={(e) => setMaquinaId(e.target.value as number)}
          >
            {(maquinas ?? [])
              .filter((m) => m.ativo)
              .map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.nome} (Modbus #{m.endereco_modbus})
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      </Paper>

      {maquinaId === '' && (
        <Alert severity="info">Selecione uma maquina ativa para acessar os controles.</Alert>
      )}

      {maquinaId !== '' && loadingStatus && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {maquinaId !== '' && !loadingStatus && status && (
        <>
          <Typography variant="h6" fontWeight={600} mb={2}>
            Comandos
          </Typography>

          <Grid container spacing={2} mb={3}>
            {relayDefinitions.map((relay) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={relay.key}>
                <ControleRelayCard
                  relay={{
                    ...relay,
                    status: getRelayStatus(relay.key, status),
                    loading: enviarComandoMutation.isPending,
                  }}
                  onToggle={handleToggle}
                  onPulse={handlePulse}
                />
              </Grid>
            ))}
          </Grid>

          <Typography variant="h6" fontWeight={600} mb={2}>
            Setpoints (via Modbus)
          </Typography>

          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={6} md={4}>
              <SetpointEditor
                tipo="temperatura"
                valorAtual={22.5}
                min={-50}
                max={150}
                step={0.5}
                unidade="°C"
                loading={alterarSetpointMutation.isPending}
                onSalvar={handleSalvarSetpoint}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <SetpointEditor
                tipo="umidade"
                valorAtual={60}
                min={0}
                max={100}
                step={1}
                unidade="%"
                loading={alterarSetpointMutation.isPending}
                onSalvar={handleSalvarSetpoint}
              />
            </Grid>
          </Grid>

          <Typography variant="h6" fontWeight={600} mb={2}>
            Registradores Modbus
          </Typography>

          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Temperatura (256)</Typography>
                <Typography variant="h6">{(status as any).temperatura ?? '--'}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Umidade (260)</Typography>
                <Typography variant="h6">{(status as any).umidade ?? '--'}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Alarmes (32895)</Typography>
                <Chip
                  label={(status as any).alarme ? 'ATIVO' : 'OK'}
                  color={(status as any).alarme ? 'error' : 'success'}
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              </Paper>
            </Grid>
          </Grid>

          <Typography variant="h6" fontWeight={600} mb={2}>
            Historico de Comandos
          </Typography>

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data/Hora</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Valor</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(comandos ?? []).map((cmd) => (
                  <TableRow key={cmd.id}>
                    <TableCell>{new Date(cmd.data_hora).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>{cmd.tipo}</TableCell>
                    <TableCell>{cmd.valor}</TableCell>
                    <TableCell>
                      <Chip
                        label={cmd.sucesso ? 'OK' : 'FALHA'}
                        color={cmd.sucesso ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {(comandos ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      Nenhum comando registrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
