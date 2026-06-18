package modbus

import (
	"encoding/binary"
	"fmt"
	"math"
	"sync"
	"time"

	"dixell-monitor/internal/models"

	"github.com/goburrow/modbus"
	"github.com/sirupsen/logrus"
)

type DixellReading struct {
	Temperatura        float64
	Umidade            float64
	SetpointTemperatura float64
	SetpointUmidade    float64
	Alarmes            int
	Status             int
}

type Client interface {
	ReadRegisters(slaveID byte) (*DixellReading, error)
	Close() error
}

type rtuClient struct {
	handler *modbus.RTUClientHandler
	client  modbus.Client
	mu      sync.Mutex
	timeout time.Duration
	log     *logrus.Entry
}

func NewClient(port string, baudrate int, parity string, stopbits int, timeoutSec int) Client {
	handler := modbus.NewRTUClientHandler(port)
	handler.BaudRate = baudrate
	handler.DataBits = 8
	handler.Parity = parity
	handler.StopBits = stopbits
	handler.Timeout = time.Duration(timeoutSec) * time.Second

	return &rtuClient{
		handler: handler,
		timeout: time.Duration(timeoutSec) * time.Second,
		log:     logrus.WithField("component", "modbus"),
	}
}

func (c *rtuClient) connect() error {
	if err := c.handler.Connect(); err != nil {
		return fmt.Errorf("falha ao conectar na porta serial: %w", err)
	}
	c.client = modbus.NewClient(c.handler)
	return nil
}

func (c *rtuClient) ReadRegisters(slaveID byte) (*DixellReading, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.connect(); err != nil {
		return nil, err
	}
	defer c.handler.Close()

	c.handler.SlaveId = slaveID

	reading := &DixellReading{}

	if results, err := c.client.ReadHoldingRegisters(DixellRegisters.Temperatura, 1); err == nil && len(results) >= 2 {
		reading.Temperatura = decodeRegister(results, 0)
	} else {
		c.log.WithField("slave", slaveID).Warnf("falha ao ler temperatura: %v", err)
	}

	time.Sleep(100 * time.Millisecond)

	if results, err := c.client.ReadHoldingRegisters(DixellRegisters.Umidade, 1); err == nil && len(results) >= 2 {
		reading.Umidade = decodeRegister(results, 0)
	} else {
		c.log.WithField("slave", slaveID).Warnf("falha ao ler umidade: %v", err)
	}

	return reading, nil
}

func (c *rtuClient) Close() error {
	return c.handler.Close()
}

func decodeRegister(data []byte, index int) float64 {
	offset := index * 2
	if offset+1 >= len(data) {
		return 0
	}
	raw := int16(binary.BigEndian.Uint16(data[offset : offset+2]))
	return math.Round(float64(raw) / FatorDivisao)
}

func decodeInt16(data []byte, index int) int {
	offset := index * 2
	if offset+1 >= len(data) {
		return 0
	}
	return int(int16(binary.BigEndian.Uint16(data[offset : offset+2])))
}

func ReadingToLeitura(reading *DixellReading, maquinaID uint) *models.Leitura {
	t := reading.Temperatura
	u := reading.Umidade
	st := reading.SetpointTemperatura
	su := reading.SetpointUmidade
	a := reading.Alarmes
	s := reading.Status

	return &models.Leitura{
		MaquinaID:           maquinaID,
		Temperatura:         &t,
		Umidade:             &u,
		SetpointTemperatura: &st,
		SetpointUmidade:     &su,
		Alarmes:             &a,
		Status:              &s,
		DataHora:            time.Now(),
	}
}
