package services

import (
	"fmt"

	"dixell-monitor/internal/models"
	"dixell-monitor/internal/repositories"

	"github.com/sirupsen/logrus"
)

type MaquinaService interface {
	Listar() ([]models.Maquina, error)
	BuscarPorID(id uint) (*models.Maquina, error)
	Criar(nome string, endereco int, setpoints *models.MaquinaSetpoints) (*models.Maquina, error)
	Atualizar(id uint, nome string, endereco int, ativo bool, setpoints *models.MaquinaSetpoints) (*models.Maquina, error)
	AtualizarSetpoints(id uint, setpoints *models.MaquinaSetpoints) (*models.Maquina, error)
	Remover(id uint) error
}

type maquinaService struct {
	repo repositories.MaquinaRepository
	log  *logrus.Entry
}

func NewMaquinaService(repo repositories.MaquinaRepository) MaquinaService {
	return &maquinaService{
		repo: repo,
		log:  logrus.WithField("service", "maquina"),
	}
}

func (s *maquinaService) Listar() ([]models.Maquina, error) {
	return s.repo.FindAll()
}

func (s *maquinaService) BuscarPorID(id uint) (*models.Maquina, error) {
	return s.repo.FindByID(id)
}

func (s *maquinaService) Criar(nome string, endereco int, setpoints *models.MaquinaSetpoints) (*models.Maquina, error) {
	if endereco < 1 || endereco > 247 {
		return nil, fmt.Errorf("endereco modbus invalido: %d (deve ser entre 1 e 247)", endereco)
	}

	if nome == "" {
		return nil, fmt.Errorf("nome da maquina nao pode ser vazio")
	}

	maquina := &models.Maquina{
		Nome:           nome,
		EnderecoModbus: endereco,
		Ativo:          true,
	}

	if setpoints != nil {
		maquina.SetpointTempMax = setpoints.SetpointTempMax
		maquina.SetpointTempMin = setpoints.SetpointTempMin
		maquina.SetpointUmidMax = setpoints.SetpointUmidMax
		maquina.SetpointUmidMin = setpoints.SetpointUmidMin
	}

	if err := s.repo.Create(maquina); err != nil {
		s.log.Errorf("erro ao criar maquina: %v", err)
		return nil, fmt.Errorf("erro ao criar maquina: %w", err)
	}

	s.log.Infof("maquina criada: %s (endereco %d)", nome, endereco)
	return maquina, nil
}

func (s *maquinaService) Atualizar(id uint, nome string, endereco int, ativo bool, setpoints *models.MaquinaSetpoints) (*models.Maquina, error) {
	maquina, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("maquina nao encontrada: %w", err)
	}

	maquina.Nome = nome
	maquina.EnderecoModbus = endereco
	maquina.Ativo = ativo

	if setpoints != nil {
		maquina.SetpointTempMax = setpoints.SetpointTempMax
		maquina.SetpointTempMin = setpoints.SetpointTempMin
		maquina.SetpointUmidMax = setpoints.SetpointUmidMax
		maquina.SetpointUmidMin = setpoints.SetpointUmidMin
	}

	if err := s.repo.Update(maquina); err != nil {
		s.log.Errorf("erro ao atualizar maquina: %v", err)
		return nil, fmt.Errorf("erro ao atualizar maquina: %w", err)
	}

	return maquina, nil
}

func (s *maquinaService) AtualizarSetpoints(id uint, setpoints *models.MaquinaSetpoints) (*models.Maquina, error) {
	maquina, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("maquina nao encontrada: %w", err)
	}

	maquina.SetpointTempMax = setpoints.SetpointTempMax
	maquina.SetpointTempMin = setpoints.SetpointTempMin
	maquina.SetpointUmidMax = setpoints.SetpointUmidMax
	maquina.SetpointUmidMin = setpoints.SetpointUmidMin

	if err := s.repo.Update(maquina); err != nil {
		s.log.Errorf("erro ao atualizar setpoints: %v", err)
		return nil, fmt.Errorf("erro ao atualizar setpoints: %w", err)
	}

	s.log.Infof("setpoints atualizados para maquina ID %d", id)
	return maquina, nil
}

func (s *maquinaService) Remover(id uint) error {
	if err := s.repo.Delete(id); err != nil {
		s.log.Errorf("erro ao remover maquina: %v", err)
		return fmt.Errorf("erro ao remover maquina: %w", err)
	}
	return nil
}
