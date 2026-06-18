import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Tooltip,
} from '@mui/material';
import { Thermostat, WaterDrop, Circle, Warning } from '@mui/icons-material';

interface CachedData {
  temperatura: number;
  umidade: number;
  data_hora: string;
}

export interface AlertaMaquina {
  tempMax: boolean;
  tempMin: boolean;
  umidMax: boolean;
  umidMin: boolean;
}

export interface ResumoDiarioMaquina {
  temp_min: number;
  temp_max: number;
  umid_min: number;
  umid_max: number;
}

interface MaquinaCardProps {
  nome: string;
  data: CachedData | null;
  alerta?: AlertaMaquina;
  offline?: boolean;
  ultimaAtualizacao?: string;
}

export default function MaquinaCard({
  nome,
  data,
  alerta,
  offline,
  ultimaAtualizacao,
}: MaquinaCardProps) {
  const temp = data?.temperatura ?? null;
  const umid = data?.umidade ?? null;
  const online = data !== null && !offline;

  const hasAlerta = alerta
    ? alerta.tempMax || alerta.tempMin || alerta.umidMax || alerta.umidMin
    : false;

  const tempColor = temp === null ? 'text.secondary'
    : temp > 30 ? 'error.main'
    : temp < 0 ? 'info.main'
    : 'success.main';

  const umidColor = umid === null ? 'text.secondary'
    : umid > 90 ? 'error.main'
    : umid < 10 ? 'warning.main'
    : 'primary.main';

  const alertaChips: string[] = [];
  if (alerta?.tempMax) alertaChips.push(`T > max`);
  if (alerta?.tempMin) alertaChips.push(`T < min`);
  if (alerta?.umidMax) alertaChips.push(`U > max`);
  if (alerta?.umidMin) alertaChips.push(`U < min`);

  const cardContent = (
    <Card
      sx={{
        minWidth: 200,
        borderLeft: 4,
        borderColor: offline
          ? 'error.main'
          : hasAlerta
          ? 'error.main'
          : online
          ? 'success.main'
          : 'grey.400',
        '&:hover': { boxShadow: 6 },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Circle
            sx={{ fontSize: 12, color: offline ? '#f44336' : online ? '#4caf50' : '#f44336' }}
          />
          <Typography variant="subtitle1" fontWeight={700}>
            {nome}
          </Typography>
          {hasAlerta && (
            <Warning color="error" sx={{ fontSize: 18 }} />
          )}
        </Box>

        {offline && (
          <Chip
            label="Sem comunicacao"
            color="error"
            size="small"
            sx={{ mb: 1 }}
          />
        )}

        {hasAlerta && !offline && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
            {alertaChips.map((chip) => (
              <Chip key={chip} label={chip} color="error" size="small" variant="outlined" />
            ))}
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Thermostat sx={{ color: tempColor }} />
            <Typography variant="h3" fontWeight={700} color={tempColor} sx={{ fontSize: { xs: '2rem', sm: '2.5rem' } }}>
              {temp !== null ? `${Math.round(temp)}°` : '--'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <WaterDrop sx={{ color: umidColor }} />
            <Typography variant="h3" fontWeight={700} color={umidColor} sx={{ fontSize: { xs: '2rem', sm: '2.5rem' } }}>
              {umid !== null ? `${Math.round(umid)}%` : '--'}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (offline && ultimaAtualizacao) {
    return (
      <Tooltip title={`Ultima leitura: ${new Date(ultimaAtualizacao).toLocaleString('pt-BR')}`}>
        {cardContent}
      </Tooltip>
    );
  }

  return cardContent;
}
