package repositories

import (
	"time"

	"dixell-monitor/internal/models"

	"gorm.io/gorm"
)

type LeituraRepository interface {
	FindAll(limit, offset int) ([]models.Leitura, error)
	FindByMaquinaID(maquinaID uint, limit, offset int) ([]models.Leitura, error)
	FindUltima(maquinaID uint) (*models.Leitura, error)
	FindByPeriodo(filtro *models.LeituraFiltro, limit, offset int) ([]models.Leitura, error)
	FindEstatisticas(maquinaID uint) (*models.Estatisticas, error)
	FindEstatisticasDiarias(maquinaID uint, data time.Time) ([]models.EstatisticaDiaria, error)
	FindByPeriodoMultiplas(maquinaIDs []uint, inicio, fim *time.Time, limit, offset int) ([]models.Leitura, error)
	Create(leitura *models.Leitura) error
	Count() (int64, error)
}

type leituraRepository struct {
	db *gorm.DB
}

func NewLeituraRepository(db *gorm.DB) LeituraRepository {
	return &leituraRepository{db: db}
}

func (r *leituraRepository) FindAll(limit, offset int) ([]models.Leitura, error) {
	var leituras []models.Leitura
	err := r.db.Preload("Maquina").Order("data_hora DESC").Limit(limit).Offset(offset).Find(&leituras).Error
	return leituras, err
}

func (r *leituraRepository) FindByMaquinaID(maquinaID uint, limit, offset int) ([]models.Leitura, error) {
	var leituras []models.Leitura
	err := r.db.Where("maquina_id = ?", maquinaID).
		Order("data_hora DESC").
		Limit(limit).Offset(offset).
		Find(&leituras).Error
	return leituras, err
}

func (r *leituraRepository) FindUltima(maquinaID uint) (*models.Leitura, error) {
	var leitura models.Leitura
	err := r.db.Where("maquina_id = ?", maquinaID).
		Order("data_hora DESC").
		First(&leitura).Error
	if err != nil {
		return nil, err
	}
	return &leitura, nil
}

func (r *leituraRepository) FindByPeriodo(filtro *models.LeituraFiltro, limit, offset int) ([]models.Leitura, error) {
	var leituras []models.Leitura
	query := r.db.Model(&models.Leitura{}).Preload("Maquina")
	query = filtro.Apply(query)
	err := query.Order("data_hora ASC").Limit(limit).Offset(offset).Find(&leituras).Error
	return leituras, err
}

func (r *leituraRepository) FindEstatisticas(maquinaID uint) (*models.Estatisticas, error) {
	var stats models.Estatisticas
	err := r.db.Model(&models.Leitura{}).
		Where("maquina_id = ?", maquinaID).
		Select(`
			MAX(temperatura) as temperatura_max,
			MIN(temperatura) as temperatura_min,
			AVG(temperatura) as temperatura_media,
			MAX(umidade) as umidade_max,
			MIN(umidade) as umidade_min,
			AVG(umidade) as umidade_media
		`).Scan(&stats).Error
	return &stats, err
}

func (r *leituraRepository) FindEstatisticasDiarias(maquinaID uint, data time.Time) ([]models.EstatisticaDiaria, error) {
	inicio := time.Date(data.Year(), data.Month(), data.Day(), 0, 0, 0, 0, data.Location())
	fim := inicio.Add(24 * time.Hour)

	var results []models.EstatisticaDiaria
	err := r.db.Model(&models.Leitura{}).
		Where("maquina_id = ? AND data_hora >= ? AND data_hora < ?", maquinaID, inicio, fim).
		Select(`
			EXTRACT(HOUR FROM data_hora)::int as hora,
			MAX(temperatura) as temperatura_max,
			MIN(temperatura) as temperatura_min,
			AVG(temperatura) as temperatura_media,
			MAX(umidade) as umidade_max,
			MIN(umidade) as umidade_min,
			AVG(umidade) as umidade_media
		`).
		Group("EXTRACT(HOUR FROM data_hora)").
		Order("hora ASC").
		Scan(&results).Error
	return results, err
}

func (r *leituraRepository) FindByPeriodoMultiplas(maquinaIDs []uint, inicio, fim *time.Time, limit, offset int) ([]models.Leitura, error) {
	var leituras []models.Leitura
	query := r.db.Model(&models.Leitura{}).Preload("Maquina")

	if len(maquinaIDs) > 0 {
		query = query.Where("maquina_id IN ?", maquinaIDs)
	}
	if inicio != nil {
		query = query.Where("data_hora >= ?", *inicio)
	}
	if fim != nil {
		query = query.Where("data_hora <= ?", *fim)
	}

	err := query.Order("data_hora ASC").Limit(limit).Offset(offset).Find(&leituras).Error
	return leituras, err
}

func (r *leituraRepository) Create(leitura *models.Leitura) error {
	return r.db.Create(leitura).Error
}

func (r *leituraRepository) Count() (int64, error) {
	var count int64
	err := r.db.Model(&models.Leitura{}).Count(&count).Error
	return count, err
}
