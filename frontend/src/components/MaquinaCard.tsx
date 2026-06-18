import {
  Card,
  CardContent,
  Typography,
  Box,
} from '@mui/material';
import { Thermostat, WaterDrop, Circle } from '@mui/icons-material';

interface CachedData {
  temperatura: number;
  umidade: number;
  data_hora: string;
}

interface MaquinaCardProps {
  nome: string;
  data: CachedData | null;
}

export default function MaquinaCard({ nome, data }: MaquinaCardProps) {
  const temp = data?.temperatura ?? null;
  const umid = data?.umidade ?? null;
  const online = data !== null;

  const tempColor = temp === null ? 'text.secondary'
    : temp > 30 ? 'error.main'
    : temp < 0 ? 'info.main'
    : 'success.main';

  const umidColor = umid === null ? 'text.secondary'
    : umid > 90 ? 'error.main'
    : umid < 10 ? 'warning.main'
    : 'primary.main';

  return (
    <Card
      sx={{
        minWidth: 200,
        borderLeft: 4,
        borderColor: online ? 'success.main' : 'grey.400',
        '&:hover': { boxShadow: 6 },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Circle
            sx={{ fontSize: 12, color: online ? '#4caf50' : '#f44336' }}
          />
          <Typography variant="subtitle1" fontWeight={700}>
            {nome}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Thermostat sx={{ color: tempColor }} />
            <Typography variant="h4" fontWeight={700} color={tempColor}>
              {temp !== null ? `${Math.round(temp)}°` : '--'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <WaterDrop sx={{ color: umidColor }} />
            <Typography variant="h4" fontWeight={700} color={umidColor}>
              {umid !== null ? `${Math.round(umid)}%` : '--'}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
