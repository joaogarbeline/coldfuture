package scheduler

import (
	"context"
	"time"

	"dixell-monitor/internal/services"

	"github.com/sirupsen/logrus"
)

type Scheduler struct {
	monitor  services.MonitorService
	interval time.Duration
	log      *logrus.Entry
}

func NewScheduler(monitor services.MonitorService, interval time.Duration) *Scheduler {
	return &Scheduler{
		monitor:  monitor,
		interval: interval,
		log:      logrus.WithField("component", "scheduler"),
	}
}

func (s *Scheduler) Start(ctx context.Context) {
	s.log.Infof("scheduler iniciado com intervalo de %s", s.interval)

	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	if err := s.monitor.RealizarLeitura(); err != nil {
		s.log.Errorf("erro na leitura inicial: %v", err)
	}

	for {
		select {
		case <-ctx.Done():
			s.log.Info("scheduler encerrado")
			return
		case <-ticker.C:
			if err := s.monitor.RealizarLeitura(); err != nil {
				s.log.Errorf("erro na leitura periodica: %v", err)
			}
		}
	}
}
