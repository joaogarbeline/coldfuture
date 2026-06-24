import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Slider,
  Button,
  CircularProgress,
  TextField,
} from '@mui/material';
import { Thermostat, WaterDrop } from '@mui/icons-material';

interface SetpointEditorProps {
  tipo: 'temperatura' | 'umidade';
  valorAtual: number;
  min: number;
  max: number;
  step: number;
  unidade: string;
  loading?: boolean;
  onSalvar: (tipo: 'temperatura' | 'umidade', valor: number) => void;
}

export default function SetpointEditor({
  tipo,
  valorAtual,
  min,
  max,
  step,
  unidade,
  loading,
  onSalvar,
}: SetpointEditorProps) {
  const [valor, setValor] = useState(valorAtual);
  const isTemp = tipo === 'temperatura';

  return (
    <Card sx={{ minWidth: 280 }}>
      <CardHeader
        avatar={
          <Box sx={{ color: isTemp ? 'error.main' : 'primary.main' }}>
            {isTemp ? <Thermostat /> : <WaterDrop />}
          </Box>
        }
        title={`Setpoint de ${isTemp ? 'Temperatura' : 'Umidade'}`}
        titleTypographyProps={{ variant: 'subtitle2', fontWeight: 600 }}
      />
      <CardContent>
        <Box sx={{ px: 2 }}>
          <Slider
            value={valor}
            onChange={(_e, v) => setValor(v as number)}
            min={min}
            max={max}
            step={step}
            valueLabelDisplay="on"
            valueLabelFormat={(v) => `${v}${unidade}`}
            color={isTemp ? 'error' : 'primary'}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
          <TextField
            type="number"
            value={valor}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) setValor(Math.min(max, Math.max(min, v)));
            }}
            size="small"
            InputProps={{ endAdornment: <Typography variant="caption">{unidade}</Typography> }}
            sx={{ width: 120 }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={() => onSalvar(tipo, valor)}
            disabled={loading || valor === valorAtual}
            color={isTemp ? 'error' : 'primary'}
          >
            {loading ? <CircularProgress size={16} /> : 'Salvar'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
