package services

import (
	"time"

	"dixell-monitor/internal/models"
	"dixell-monitor/internal/repositories"

	"github.com/sirupsen/logrus"
)

type LeituraService interface {
	Listar(limit, offset int) ([]models.Leitura, error)
	ListarPorMaquina(maquinaID uint, limit, offset int) ([]models.Leitura, error)
	BuscarUltima(maquinaID uint) (*models.Leitura, error)
	BuscarPorPeriodo(maquinaID *uint, inicio, fim *time.Time, limit, offset int) ([]models.Leitura, error)
	BuscarEstatisticas(maquinaID uint) (*models.Estatisticas, error)
	BuscarEstatisticasDiarias(maquinaID uint, data time.Time) ([]models.EstatisticaDiaria, error)
	BuscarPorPeriodoMultiplasMaquinas(maquinaIDs []uint, inicio, fim *time.Time, limit, offset int) ([]models.Leitura, error)
	BuscarResumoDiarioHoje() ([]models.ResumoDiario, error)
	BuscarResumoDiarioPeriodo(maquinaIDs []uint, inicio, fim *time.Time) ([]models.ResumoDiario, error)
}

type leituraService struct {
	repo repositories.LeituraRepository
	log  *logrus.Entry
}

func NewLeituraService(repo repositories.LeituraRepository) LeituraService {
	return &leituraService{
		repo: repo,
		log:  logrus.WithField("service", "leitura"),
	}
}

func (s *leituraService) Listar(limit, offset int) ([]models.Leitura, error) {
	return s.repo.FindAll(limit, offset)
}

func (s *leituraService) ListarPorMaquina(maquinaID uint, limit, offset int) ([]models.Leitura, error) {
	return s.repo.FindByMaquinaID(maquinaID, limit, offset)
}

func (s *leituraService) BuscarUltima(maquinaID uint) (*models.Leitura, error) {
	return s.repo.FindUltima(maquinaID)
}

func (s *leituraService) BuscarPorPeriodo(maquinaID *uint, inicio, fim *time.Time, limit, offset int) ([]models.Leitura, error) {
	filtro := &models.LeituraFiltro{
		MaquinaID: maquinaID,
		Inicio:    inicio,
		Fim:       fim,
	}
	return s.repo.FindByPeriodo(filtro, limit, offset)
}

func (s *leituraService) BuscarEstatisticas(maquinaID uint) (*models.Estatisticas, error) {
	return s.repo.FindEstatisticas(maquinaID)
}

func (s *leituraService) BuscarEstatisticasDiarias(maquinaID uint, data time.Time) ([]models.EstatisticaDiaria, error) {
	return s.repo.FindEstatisticasDiarias(maquinaID, data)
}

func (s *leituraService) BuscarPorPeriodoMultiplasMaquinas(maquinaIDs []uint, inicio, fim *time.Time, limit, offset int) ([]models.Leitura, error) {
	return s.repo.FindByPeriodoMultiplas(maquinaIDs, inicio, fim, limit, offset)
}

func (s *leituraService) BuscarResumoDiarioHoje() ([]models.ResumoDiario, error) {
	return s.repo.FindResumoDiarioHoje()
}

func (s *leituraService) BuscarResumoDiarioPeriodo(maquinaIDs []uint, inicio, fim *time.Time) ([]models.ResumoDiario, error) {
	now := time.Now()
	loc := now.Location()

	var ini time.Time
	if inicio != nil {
		ini = time.Date(inicio.Year(), inicio.Month(), inicio.Day(), 0, 0, 0, 0, loc)
	} else {
		ini = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	}

	var f time.Time
	if fim != nil {
		f = time.Date(fim.Year(), fim.Month(), fim.Day(), 0, 0, 0, 0, loc).Add(24 * time.Hour)
	} else {
		f = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc).Add(24 * time.Hour)
	}

	return s.repo.FindResumoDiarioPeriodo(maquinaIDs, ini, f)
}
