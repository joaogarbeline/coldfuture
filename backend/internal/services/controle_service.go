package services

import (
	"fmt"
	"time"

	"dixell-monitor/internal/config"
	"dixell-monitor/internal/models"
	"dixell-monitor/internal/modbus"
	"dixell-monitor/internal/repositories"

	"github.com/sirupsen/logrus"
)

type ControleService interface {
	EnviarComando(maquinaID uint, tipo, valor string) (*models.Comando, error)
	LerStatusControle(maquinaID uint) (*modbus.StatusControle, error)
	LerSetpoints(maquinaID uint) (*modbus.SetpointValues, error)
	AlterarSetpoint(maquinaID uint, tipo string, valor float64) (*models.Comando, error)
	ListarComandos(maquinaID *uint, limit, offset int) ([]models.Comando, error)
}

type controleService struct {
	cfg         *config.Config
	maquinaRepo repositories.MaquinaRepository
	comandoRepo repositories.ComandoRepository
	log         *logrus.Entry
}

func NewControleService(
	cfg *config.Config,
	maquinaRepo repositories.MaquinaRepository,
	comandoRepo repositories.ComandoRepository,
) ControleService {
	return &controleService{
		cfg:         cfg,
		maquinaRepo: maquinaRepo,
		comandoRepo: comandoRepo,
		log:         logrus.WithField("service", "controle"),
	}
}

func (s *controleService) getMaquinaED(maquinaID uint) (*models.Maquina, byte, error) {
	maquina, err := s.maquinaRepo.FindByID(maquinaID)
	if err != nil {
		return nil, 0, fmt.Errorf("maquina nao encontrada: %w", err)
	}
	if !maquina.Ativo {
		return nil, 0, fmt.Errorf("maquina inativa")
	}
	return maquina, byte(maquina.EnderecoModbus), nil
}

func (s *controleService) EnviarComando(maquinaID uint, tipo, valor string) (*models.Comando, error) {
	maquina, slaveID, err := s.getMaquinaED(maquinaID)
	if err != nil {
		return nil, err
	}

	client := modbus.NewClient(s.cfg)
	defer client.Close()

	comando := &models.Comando{
		MaquinaID: maquina.ID,
		Tipo:      tipo,
		Valor:     valor,
		DataHora:  time.Now(),
	}

	var registerValue uint16

	switch tipo {
	case "liga_desliga":
		if valor == "on" {
			registerValue = modbus.CmdLigar
		} else {
			registerValue = modbus.CmdDesligar
		}
		err = client.WriteSingleRegister(slaveID, modbus.DixellRegisters.Comando, registerValue)
		if err == nil {
			s.log.Infof("comando liga/desliga (%d) enviado para %s", registerValue, maquina.Nome)
		}

	case "degelo":
		registerValue = modbus.CmdDegelo
		err = client.WriteSingleRegister(slaveID, modbus.DixellRegisters.Comando, registerValue)
		if err == nil {
			s.log.Infof("comando degelo (%d) enviado para %s", registerValue, maquina.Nome)
		}

	case "setpoint_temperatura":
		return s.AlterarSetpoint(maquinaID, "temperatura", parseValorFloat(valor))

	case "setpoint_umidade":
		return s.AlterarSetpoint(maquinaID, "umidade", parseValorFloat(valor))

	default:
		err = fmt.Errorf("tipo de comando desconhecido: %s", tipo)
	}

	if err != nil {
		comando.Sucesso = false
		comando.Mensagem = err.Error()
		s.log.Errorf("erro ao enviar comando %s para %s: %v", tipo, maquina.Nome, err)
	} else {
		comando.Sucesso = true
		comando.Mensagem = fmt.Sprintf("comando %s=%s executado com sucesso", tipo, valor)
	}

	_ = s.comandoRepo.Create(comando)
	return comando, nil
}

func (s *controleService) LerStatusControle(maquinaID uint) (*modbus.StatusControle, error) {
	_, slaveID, err := s.getMaquinaED(maquinaID)
	if err != nil {
		return nil, err
	}

	client := modbus.NewClient(s.cfg)
	defer client.Close()

	return client.ReadStatusControle(slaveID)
}

func (s *controleService) LerSetpoints(maquinaID uint) (*modbus.SetpointValues, error) {
	_, slaveID, err := s.getMaquinaED(maquinaID)
	if err != nil {
		return nil, err
	}

	client := modbus.NewClient(s.cfg)
	defer client.Close()

	return client.ReadSetpoints(slaveID)
}

func (s *controleService) AlterarSetpoint(maquinaID uint, tipo string, valor float64) (*models.Comando, error) {
	maquina, slaveID, err := s.getMaquinaED(maquinaID)
	if err != nil {
		return nil, err
	}

	client := modbus.NewClient(s.cfg)
	defer client.Close()

	var endereco uint16
	var label string
	var rawValue uint16

	if tipo == "temperatura" {
		endereco = modbus.DixellRegisters.SetpointTemperatura
		label = "setpoint_temperatura"
		rawValue = uint16(valor * 10)
	} else if tipo == "umidade" {
		endereco = modbus.DixellRegisters.SetpointUmidade
		label = "setpoint_umidade"
		rawValue = uint16(valor * 2)
	} else {
		return nil, fmt.Errorf("tipo de setpoint invalido: %s", tipo)
	}

	err = client.WriteSingleRegister(slaveID, endereco, rawValue)

	comando := &models.Comando{
		MaquinaID: maquina.ID,
		Tipo:      label,
		Valor:     fmt.Sprintf("%.1f", valor),
		DataHora:  time.Now(),
	}

	if err != nil {
		comando.Sucesso = false
		comando.Mensagem = err.Error()
		s.log.Errorf("erro ao alterar %s da maquina %s: %v", label, maquina.Nome, err)
	} else {
		comando.Sucesso = true
		comando.Mensagem = fmt.Sprintf("%s alterado para %.1f com sucesso", label, valor)
		s.log.Infof("%s da maquina %s alterado para %.1f (raw=%d)", label, maquina.Nome, valor, rawValue)
	}

	_ = s.comandoRepo.Create(comando)
	return comando, nil
}

func (s *controleService) ListarComandos(maquinaID *uint, limit, offset int) ([]models.Comando, error) {
	if maquinaID != nil {
		return s.comandoRepo.FindByMaquina(*maquinaID, limit, offset)
	}
	return s.comandoRepo.FindAll(limit, offset)
}

func parseValorFloat(valor string) float64 {
	var f float64
	fmt.Sscanf(valor, "%f", &f)
	return f
}

