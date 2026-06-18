package repositories

import (
	"dixell-monitor/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ConfiguracaoRepository interface {
	Buscar(chave string) (string, error)
	Salvar(chave, valor string) error
	BuscarTodas() (map[string]string, error)
}

type configuracaoRepository struct {
	db *gorm.DB
}

func NewConfiguracaoRepository(db *gorm.DB) ConfiguracaoRepository {
	return &configuracaoRepository{db: db}
}

func (r *configuracaoRepository) Buscar(chave string) (string, error) {
	var c models.ConfiguracaoSistema
	err := r.db.Where("chave = ?", chave).First(&c).Error
	if err != nil {
		return "", err
	}
	return c.Valor, nil
}

func (r *configuracaoRepository) Salvar(chave, valor string) error {
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "chave"}},
		DoUpdates: clause.AssignmentColumns([]string{"valor"}),
	}).Create(&models.ConfiguracaoSistema{Chave: chave, Valor: valor}).Error
}

func (r *configuracaoRepository) BuscarTodas() (map[string]string, error) {
	var configs []models.ConfiguracaoSistema
	err := r.db.Find(&configs).Error
	if err != nil {
		return nil, err
	}
	result := make(map[string]string, len(configs))
	for _, c := range configs {
		result[c.Chave] = c.Valor
	}
	return result, nil
}
