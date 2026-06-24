import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Switch,
  Button,
  CircularProgress,
  Tooltip,
  Chip,
} from '@mui/material';

interface ControleRelay {
  key: string;
  label: string;
  emoji: string;
  status?: boolean;
  loading?: boolean;
  writable: boolean;
  isPulse?: boolean;
}

interface ControleRelayCardProps {
  relay: ControleRelay;
  onToggle: (key: string, value: boolean) => void;
  onPulse: (key: string) => void;
}

export default function ControleRelayCard({ relay, onToggle, onPulse }: ControleRelayCardProps) {
  const [loadingLocal, setLoadingLocal] = useState(false);

  const handleToggle = async () => {
    if (relay.isPulse) {
      setLoadingLocal(true);
      try {
        onPulse(relay.key);
      } finally {
        setLoadingLocal(false);
      }
      return;
    }
    onToggle(relay.key, !relay.status);
  };

  const isLoading = loadingLocal || relay.loading;

  return (
    <Card
      sx={{
        minWidth: 160,
        borderLeft: 4,
        borderColor: relay.status ? 'success.main' : 'grey.400',
      }}
    >
      <CardHeader
        avatar={
          <Typography variant="h5" component="span">
            {relay.emoji}
          </Typography>
        }
        title={relay.label}
        titleTypographyProps={{ variant: 'subtitle2', fontWeight: 600 }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: relay.status ? 'success.main' : 'grey.400',
                boxShadow: relay.status ? '0 0 6px #4caf50' : 'none',
              }}
            />
            <Chip
              label={relay.status ? 'LIGADO' : 'DESLIGADO'}
              color={relay.status ? 'success' : 'default'}
              size="small"
              variant="outlined"
            />
          </Box>
          {relay.writable && !relay.isPulse && (
            <Switch
              checked={relay.status ?? false}
              onChange={handleToggle}
              disabled={isLoading}
              color="success"
            />
          )}
          {relay.writable && relay.isPulse && (
            <Tooltip title="Clique para acionar (pulso)">
              <Button
                variant="contained"
                size="small"
                onClick={handleToggle}
                disabled={isLoading}
                color="warning"
              >
                {isLoading ? <CircularProgress size={16} /> : 'FORÇAR'}
              </Button>
            </Tooltip>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export const relayDefinitions: ControleRelay[] = [
  { key: 'liga_desliga', label: 'Liga/Desliga', emoji: '\u26A1', writable: true },
  { key: 'degelo', label: 'Degelo Manual', emoji: '\uD83D\uDD25', writable: true, isPulse: true },
  { key: 'refrigeracao', label: 'Refrigeracao', emoji: '\u2744\uFE0F', writable: false },
  { key: 'ventilacao', label: 'Ventilacao', emoji: '\uD83C\uDF2C\uFE0F', writable: false },
  { key: 'desumidificacao', label: 'Desumidificacao', emoji: '\u2601\uFE0F', writable: false },
];
