package repositories

import (
	"dixell-monitor/internal/models"

	"gorm.io/gorm"
)

type MaquinaRepository interface {
	FindAll() ([]models.Maquina, error)
	FindByID(id uint) (*models.Maquina, error)
	FindAtivas() ([]models.Maquina, error)
	Create(maquina *models.Maquina) error
	Update(maquina *models.Maquina) error
	Delete(id uint) error
}

type maquinaRepository struct {
	db *gorm.DB
}

func NewMaquinaRepository(db *gorm.DB) MaquinaRepository {
	return &maquinaRepository{db: db}
}

func (r *maquinaRepository) FindAll() ([]models.Maquina, error) {
	var maquinas []models.Maquina
	err := r.db.Order("id ASC").Find(&maquinas).Error
	return maquinas, err
}

func (r *maquinaRepository) FindByID(id uint) (*models.Maquina, error) {
	var maquina models.Maquina
	err := r.db.First(&maquina, id).Error
	if err != nil {
		return nil, err
	}
	return &maquina, nil
}

func (r *maquinaRepository) FindAtivas() ([]models.Maquina, error) {
	var maquinas []models.Maquina
	err := r.db.Where("ativo = ?", true).Order("endereco_modbus ASC").Find(&maquinas).Error
	return maquinas, err
}

func (r *maquinaRepository) Create(maquina *models.Maquina) error {
	return r.db.Create(maquina).Error
}

func (r *maquinaRepository) Update(maquina *models.Maquina) error {
	return r.db.Save(maquina).Error
}

func (r *maquinaRepository) Delete(id uint) error {
	return r.db.Delete(&models.Maquina{}, id).Error
}
