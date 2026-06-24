package repositories

import (
	"dixell-monitor/internal/models"

	"gorm.io/gorm"
)

type ComandoRepository interface {
	Create(comando *models.Comando) error
	FindByMaquina(maquinaID uint, limit, offset int) ([]models.Comando, error)
	FindAll(limit, offset int) ([]models.Comando, error)
}

type comandoRepository struct {
	db *gorm.DB
}

func NewComandoRepository(db *gorm.DB) ComandoRepository {
	return &comandoRepository{db: db}
}

func (r *comandoRepository) Create(comando *models.Comando) error {
	return r.db.Create(comando).Error
}

func (r *comandoRepository) FindByMaquina(maquinaID uint, limit, offset int) ([]models.Comando, error) {
	var comandos []models.Comando
	err := r.db.Where("maquina_id = ?", maquinaID).
		Order("data_hora DESC").
		Limit(limit).Offset(offset).
		Find(&comandos).Error
	return comandos, err
}

func (r *comandoRepository) FindAll(limit, offset int) ([]models.Comando, error) {
	var comandos []models.Comando
	err := r.db.Preload("Maquina").
		Order("data_hora DESC").
		Limit(limit).Offset(offset).
		Find(&comandos).Error
	return comandos, err
}
