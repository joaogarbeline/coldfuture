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
