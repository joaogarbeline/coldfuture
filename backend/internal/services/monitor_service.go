package services

import (
	"fmt"
	"sync"
	"time"

	"dixell-monitor/internal/config"
	"dixell-monitor/internal/modbus"
	"dixell-monitor/internal/repositories"

	"github.com/sirupsen/logrus"
)

type CachedLeitura struct {
	MaquinaID     uint
	Temperatura   float64
	Umidade       float64
	DataHora      time.Time
	UltimaLeitura time.Time
	Stale         bool
}

type MonitorService interface {
	RealizarLeitura() error
	ObterCache() map[uint]CachedLeitura
}

type monitorService struct {
	cfg        *config.Config
	maqRepo    repositories.MaquinaRepository
	leitRepo   repositories.LeituraRepository
	log        *logrus.Entry
	mu         sync.RWMutex
	cache      map[uint]CachedLeitura
}

func NewMonitorService(
	cfg *config.Config,
	maqRepo repositories.MaquinaRepository,
	leitRepo repositories.LeituraRepository,
) MonitorService {
	return &monitorService{
		cfg:      cfg,
		maqRepo:  maqRepo,
		leitRepo: leitRepo,
		log:      logrus.WithField("service", "monitor"),
		cache:    make(map[uint]CachedLeitura),
	}
}

func (s *monitorService) ObterCache() map[uint]CachedLeitura {
	s.mu.RLock()
	defer s.mu.RUnlock()
	agora := time.Now()
	result := make(map[uint]CachedLeitura, len(s.cache))
	for k, v := range s.cache {
		v.Stale = agora.Sub(v.UltimaLeitura) > 600*time.Second
		result[k] = v
	}
	return result
}

func (s *monitorService) RealizarLeitura() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	maquinas, err := s.maqRepo.FindAtivas()
	if err != nil {
		s.log.Errorf("erro ao buscar maquinas ativas: %v", err)
		return fmt.Errorf("erro ao buscar maquinas ativas: %w", err)
	}

	if len(maquinas) == 0 {
		return nil
	}

	client := modbus.NewClient(
		s.cfg.ModbusPort,
		s.cfg.ModbusBaudrate,
		s.cfg.ModbusParity,
		s.cfg.ModbusStopbits,
		s.cfg.ModbusTimeout,
	)

	sucessos := 0
	falhas := 0
	agora := time.Now()

	for _, maquina := range maquinas {
		slaveID := byte(maquina.EnderecoModbus)

		reading, err := client.ReadRegisters(slaveID)
		if err != nil {
			s.log.WithField("maquina", maquina.Nome).
				WithField("endereco", maquina.EnderecoModbus).
				Errorf("falha na leitura: %v", err)
			falhas++
			continue
		}

		s.cache[maquina.ID] = CachedLeitura{
			MaquinaID:     maquina.ID,
			Temperatura:   reading.Temperatura,
			Umidade:       reading.Umidade,
			DataHora:      agora,
			UltimaLeitura: agora,
		}

		leitura := modbus.ReadingToLeitura(reading, maquina.ID)
		if err := s.leitRepo.Create(leitura); err != nil {
			s.log.WithField("maquina", maquina.Nome).
				Errorf("erro ao salvar leitura: %v", err)
		}

		s.log.WithField("maquina", maquina.Nome).
			Infof("Temp: %.0f°C  Umid: %.0f%%", reading.Temperatura, reading.Umidade)
		sucessos++
	}

	s.log.Infof("leitura concluida: %d sucessos, %d falhas", sucessos, falhas)

	client.Close()
	return nil
}
