package modbus

import (
	"encoding/binary"
	"fmt"
	"math"
	"net"
	"sync"
	"time"

	"dixell-monitor/internal/config"
	"dixell-monitor/internal/models"

	"github.com/goburrow/modbus"
	"github.com/sirupsen/logrus"
)

type DixellReading struct {
	Temperatura         float64
	Umidade             float64
	SetpointTemperatura float64
	SetpointUmidade     float64
	Alarmes             int
	Status              int
}

type StatusControle struct {
	Ligado          bool `json:"ligado"`
	Degelo          bool `json:"degelo"`
	Refrigeracao    bool `json:"refrigeracao"`
	Ventilacao      bool `json:"ventilacao"`
	Desumidificacao bool `json:"desumidificacao"`
}

type Client interface {
	ReadRegisters(slaveID byte) (*DixellReading, error)
	WriteSingleRegister(slaveID byte, address uint16, value uint16) error
	ReadHoldingRegister(slaveID byte, address uint16) (uint16, error)
	ReadHoldingRegisters(slaveID byte, address uint16, quantity uint16) ([]byte, error)
	ReadStatusControle(slaveID byte) (*StatusControle, error)
	ReadSetpoints(slaveID byte) (*SetpointValues, error)
	Close() error
}

type modbusClient struct {
	mode             string
	rtu              *modbus.RTUClientHandler
	tcp              *modbus.TCPClientHandler
	rawConn          net.Conn
	client           modbus.Client
	mu               sync.Mutex
	timeout          time.Duration
	cfg              *config.Config
	tcpActive        bool
	holdingSerialMu  bool
	log              *logrus.Entry
}

var serialMu sync.Mutex

func NewClient(cfg *config.Config) Client {
	return &modbusClient{
		mode:    cfg.ModbusMode,
		timeout: time.Duration(cfg.ModbusTimeout) * time.Second,
		cfg:     cfg,
		log:     logrus.WithField("component", "modbus"),
	}
}

func (c *modbusClient) connect() error {
	if c.mode == "tcp" {
		if c.tcp == nil || !c.tcpActive {
			addr := fmt.Sprintf("%s:%d", c.cfg.ModbusTCPHost, c.cfg.ModbusTCPPort)
			c.tcp = modbus.NewTCPClientHandler(addr)
			c.tcp.Timeout = c.timeout
			if err := c.tcp.Connect(); err != nil {
				c.tcpActive = false
				return fmt.Errorf("falha ao conectar Modbus TCP %s: %w", addr, err)
			}
			c.tcpActive = true
			c.client = modbus.NewClient(c.tcp)
		}
	} else if c.mode == "rtu" {
		if !c.holdingSerialMu {
			serialMu.Lock()
			c.holdingSerialMu = true
		}
		if c.rtu == nil {
			c.rtu = modbus.NewRTUClientHandler(c.cfg.ModbusPort)
			c.rtu.BaudRate = c.cfg.ModbusBaudrate
			c.rtu.DataBits = 8
			c.rtu.Parity = c.cfg.ModbusParity
			c.rtu.StopBits = c.cfg.ModbusStopbits
			c.rtu.Timeout = c.timeout
			if err := c.rtu.Connect(); err != nil {
				if c.holdingSerialMu {
					serialMu.Unlock()
					c.holdingSerialMu = false
				}
				return fmt.Errorf("falha ao conectar na porta serial: %w", err)
			}
			c.client = modbus.NewClient(c.rtu)
		}
	} else {
		if c.rawConn != nil {
			c.rawConn.Close()
		}
		addr := fmt.Sprintf("%s:%d", c.cfg.ModbusTCPHost, c.cfg.ModbusTCPPort)
		proto := "tcp"
		if c.mode == "udp" {
			proto = "udp"
		}
		d := net.Dialer{Timeout: c.timeout}
		conn, err := d.Dial(proto, addr)
		if err != nil {
			return fmt.Errorf("falha ao conectar %s %s: %w", proto, addr, err)
		}
		c.rawConn = conn
	}
	return nil
}

func modbusCRC(data []byte) uint16 {
	var crc uint16 = 0xFFFF
	for _, b := range data {
		crc ^= uint16(b)
		for i := 0; i < 8; i++ {
			if crc&1 != 0 {
				crc = (crc >> 1) ^ 0xA001
			} else {
				crc >>= 1
			}
		}
	}
	return crc
}

func (c *modbusClient) setSlaveID(slaveID byte) {
	if c.mode == "tcp" {
		c.tcp.SlaveId = slaveID
	} else if c.mode == "rtu" {
		c.rtu.SlaveId = slaveID
	}
}

func (c *modbusClient) ReadRegisters(slaveID byte) (*DixellReading, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.connect(); err != nil {
		return nil, err
	}

	reading := &DixellReading{}

	if c.mode == "tcp" || c.mode == "rtu" {
		c.setSlaveID(slaveID)

		if results, err := c.client.ReadHoldingRegisters(DixellRegisters.Temperatura, 1); err == nil && len(results) >= 2 {
			reading.Temperatura = decodeRegister(results, 0)
		} else {
			c.log.WithField("slave", slaveID).Warnf("falha ao ler temperatura: %v", err)
		}
		time.Sleep(300 * time.Millisecond)

		if results, err := c.client.ReadHoldingRegisters(DixellRegisters.Umidade, 1); err == nil && len(results) >= 2 {
			reading.Umidade = decodeRegister(results, 0)
		} else {
			c.log.WithField("slave", slaveID).Warnf("falha ao ler umidade: %v", err)
		}

		return reading, nil
	}

	if c.mode == "udp" {
		if data, err := c.readRegisterMBAP(slaveID, DixellRegisters.Temperatura); err == nil && len(data) >= 2 {
			reading.Temperatura = decodeRegister(data, 0)
		} else {
			c.log.WithField("slave", slaveID).Warnf("falha ao ler temperatura: %v", err)
		}
		time.Sleep(50 * time.Millisecond)
		if data, err := c.readRegisterMBAP(slaveID, DixellRegisters.Umidade); err == nil && len(data) >= 2 {
			reading.Umidade = decodeRegister(data, 0)
		} else {
			c.log.WithField("slave", slaveID).Warnf("falha ao ler umidade: %v", err)
		}
		return reading, nil
	}

	if c.mode == "raw" {
		if data, err := c.readRegisterRaw(slaveID, DixellRegisters.Temperatura); err == nil && len(data) >= 2 {
			reading.Temperatura = decodeRegister(data, 0)
		} else {
			c.log.WithField("slave", slaveID).Warnf("falha ao ler temperatura: %v", err)
		}
		time.Sleep(50 * time.Millisecond)
		if data, err := c.readRegisterRaw(slaveID, DixellRegisters.Umidade); err == nil && len(data) >= 2 {
			reading.Umidade = decodeRegister(data, 0)
		} else {
			c.log.WithField("slave", slaveID).Warnf("falha ao ler umidade: %v", err)
		}
		return reading, nil
	}

	return reading, nil
}

func (c *modbusClient) WriteSingleRegister(slaveID byte, address uint16, value uint16) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.connect(); err != nil {
		return err
	}

	if c.mode == "tcp" {
		c.setSlaveID(slaveID)
		_, err := c.client.WriteSingleRegister(address, value)
		if err != nil {
			return fmt.Errorf("falha ao escrever registro %d slave %d: %w", address, slaveID, err)
		}
		return nil
	}

	if c.mode == "rtu" {
		return c.writeRegisterRawRTU(slaveID, address, value)
	}

	if c.mode == "udp" {
		return c.writeRegisterMBAP(slaveID, address, value)
	}
	return c.writeRegisterRaw(slaveID, address, value)
}

func (c *modbusClient) writeRegisterRawRTU(slaveID byte, addr uint16, value uint16) error {
	// Handler já foi conectado por connect(); apenas reabre se tiver sido fechado.
	if c.rtu == nil {
		c.rtu = modbus.NewRTUClientHandler(c.cfg.ModbusPort)
		c.rtu.BaudRate = c.cfg.ModbusBaudrate
		c.rtu.DataBits = 8
		c.rtu.Parity = c.cfg.ModbusParity
		c.rtu.StopBits = c.cfg.ModbusStopbits
		c.rtu.Timeout = c.timeout
		if err := c.rtu.Connect(); err != nil {
			return fmt.Errorf("falha ao conectar serial: %w", err)
		}
	}

	c.rtu.SlaveId = slaveID

	request := []byte{slaveID, 0x06, byte(addr >> 8), byte(addr & 0xFF), byte(value >> 8), byte(value & 0xFF)}
	crc := modbusCRC(request)
	request = append(request, byte(crc), byte(crc>>8))

	response, err := c.rtu.Send(request)
	if err != nil {
		return fmt.Errorf("erro ao enviar/receber: %w", err)
	}

	if len(response) < 6 {
		return fmt.Errorf("resposta muito curta: %d bytes", len(response))
	}

	if response[1]&0x80 != 0 {
		return fmt.Errorf("excecao modbus: %d", response[2])
	}

	expectedCRC := modbusCRC(response[:len(response)-2])
	receivedCRC := binary.LittleEndian.Uint16(response[len(response)-2:])
	if expectedCRC != receivedCRC {
		return fmt.Errorf("CRC invalido")
	}

	if response[0] != slaveID {
		return fmt.Errorf("slave id incorreto na resposta: esperado %d, recebido %d", slaveID, response[0])
	}

	c.log.WithField("slave", slaveID).
		WithField("addr", addr).
		WithField("value", value).
		Infof("writeRegisterRawRTU: ok (%d bytes de resposta)", len(response))

	return nil
}

func (c *modbusClient) writeRegisterMBAP(slaveID byte, addr uint16, value uint16) error {
	if c.rawConn == nil {
		return fmt.Errorf("sem conexao")
	}
	c.rawConn.SetDeadline(time.Now().Add(c.timeout))

	req := make([]byte, 12)
	req[6] = slaveID
	req[7] = 0x06
	binary.BigEndian.PutUint16(req[8:10], addr)
	binary.BigEndian.PutUint16(req[10:12], value)
	binary.BigEndian.PutUint16(req[4:6], 6)

	if _, err := c.rawConn.Write(req); err != nil {
		return fmt.Errorf("erro ao escrever registro: %w", err)
	}

	buf := make([]byte, 256)
	n, err := c.rawConn.Read(buf)
	if err != nil {
		return fmt.Errorf("erro ao ler resposta: %w", err)
	}
	if n < 12 {
		return fmt.Errorf("resposta muito curta: %d bytes", n)
	}
	if buf[7]&0x80 != 0 {
		return fmt.Errorf("excecao modbus: %d", buf[8])
	}
	return nil
}

func (c *modbusClient) writeRegisterRaw(slaveID byte, addr uint16, value uint16) error {
	if c.rawConn == nil {
		return fmt.Errorf("sem conexao")
	}
	c.rawConn.SetDeadline(time.Now().Add(c.timeout))

	req := []byte{slaveID, 0x06, byte(addr >> 8), byte(addr & 0xFF), byte(value >> 8), byte(value & 0xFF)}
	crc := modbusCRC(req)
	req = append(req, byte(crc), byte(crc>>8))

	if _, err := c.rawConn.Write(req); err != nil {
		return fmt.Errorf("erro ao escrever registro: %w", err)
	}

	buf := make([]byte, 256)
	n, err := c.rawConn.Read(buf)
	if err != nil {
		return fmt.Errorf("erro ao ler resposta: %w", err)
	}
	if n < 6 {
		return fmt.Errorf("resposta muito curta: %d bytes", n)
	}
	if buf[1]&0x80 != 0 {
		return fmt.Errorf("excecao modbus: %d", buf[2])
	}
	return nil
}

func (c *modbusClient) ReadHoldingRegister(slaveID byte, address uint16) (uint16, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.connect(); err != nil {
		return 0, err
	}

	if c.mode == "tcp" || c.mode == "rtu" {
		c.setSlaveID(slaveID)
		if c.client == nil {
			return 0, fmt.Errorf("cliente modbus nao inicializado")
		}
		results, err := c.client.ReadHoldingRegisters(address, 1)
		if err != nil {
			return 0, fmt.Errorf("falha ao ler registro %d slave %d: %w", address, slaveID, err)
		}
		if len(results) < 2 {
			return 0, fmt.Errorf("resposta incompleta")
		}
		return binary.BigEndian.Uint16(results[0:2]), nil
	}

	if c.mode == "udp" {
		data, err := c.readRegisterMBAP(slaveID, address)
		if err != nil {
			return 0, err
		}
		if len(data) < 2 {
			return 0, fmt.Errorf("resposta incompleta")
		}
		return binary.BigEndian.Uint16(data[0:2]), nil
	}

	data, err := c.readRegisterRaw(slaveID, address)
	if err != nil {
		return 0, err
	}
	if len(data) < 2 {
		return 0, fmt.Errorf("resposta incompleta")
	}
	return binary.BigEndian.Uint16(data[0:2]), nil
}

func (c *modbusClient) ReadHoldingRegisters(slaveID byte, address uint16, quantity uint16) ([]byte, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.connect(); err != nil {
		return nil, err
	}

	if c.mode == "tcp" || c.mode == "rtu" {
		c.setSlaveID(slaveID)
		results, err := c.client.ReadHoldingRegisters(address, quantity)
		if err != nil {
			return nil, fmt.Errorf("falha ao ler registradores %d slave %d: %w", address, slaveID, err)
		}
		return results, nil
	}

	if c.mode == "udp" {
		return c.readRegisterMBAP(slaveID, address)
	}

	return c.readRegisterRaw(slaveID, address)
}

func (c *modbusClient) ReadStatusControle(slaveID byte) (*StatusControle, error) {
	onOff, err := c.ReadHoldingRegister(slaveID, DixellRegisters.StatusOnOff)
	if err != nil {
		return nil, fmt.Errorf("falha ao ler status ON/OFF: %w", err)
	}

	time.Sleep(300 * time.Millisecond)

	reles, err := c.ReadHoldingRegister(slaveID, DixellRegisters.StatusReles)
	if err != nil {
		return nil, fmt.Errorf("falha ao ler status reles: %w", err)
	}

	time.Sleep(300 * time.Millisecond)

	comando, err := c.ReadHoldingRegister(slaveID, DixellRegisters.Comando)
	if err != nil {
		comando = 0
	}

	return &StatusControle{
		Ligado:          (onOff & 1) != 0,
		Degelo:          (comando & BitDegelo) != 0,
		Refrigeracao:    (reles & BitRefrigeracao) != 0,
		Ventilacao:      (reles & BitVentilacao) != 0,
		Desumidificacao: (reles & BitDesumidificacao) == 0,
	}, nil
}

type SetpointValues struct {
	Temperatura float64 `json:"temperatura"`
	Umidade     float64 `json:"umidade"`
}

func (c *modbusClient) ReadSetpoints(slaveID byte) (*SetpointValues, error) {
	rawTemp, err := c.ReadHoldingRegister(slaveID, DixellRegisters.SetpointTemperatura)
	if err != nil {
		return nil, fmt.Errorf("falha ao ler setpoint temperatura: %w", err)
	}

	time.Sleep(300 * time.Millisecond)

	rawUmid, err := c.ReadHoldingRegister(slaveID, DixellRegisters.SetpointUmidade)
	if err != nil {
		return nil, fmt.Errorf("falha ao ler setpoint umidade: %w", err)
	}

	return &SetpointValues{
		Temperatura: float64(rawTemp) / 10.0,
		Umidade:     float64(rawUmid) / 2.0,
	}, nil
}

func (c *modbusClient) readRegisterMBAP(slaveID byte, addr uint16) ([]byte, error) {
	if c.rawConn == nil {
		return nil, fmt.Errorf("sem conexao")
	}
	c.rawConn.SetDeadline(time.Now().Add(c.timeout))

	req := make([]byte, 12)
	binary.BigEndian.PutUint16(req[0:2], 1)
	binary.BigEndian.PutUint16(req[4:6], 6)
	req[6] = slaveID
	req[7] = 0x03
	binary.BigEndian.PutUint16(req[8:10], addr)
	binary.BigEndian.PutUint16(req[10:12], 1)

	if _, err := c.rawConn.Write(req); err != nil {
		return nil, fmt.Errorf("erro ao escrever: %w", err)
	}

	buf := make([]byte, 256)
	n, err := c.rawConn.Read(buf)
	if err != nil {
		return nil, fmt.Errorf("erro ao ler: %w", err)
	}
	if n < 9 {
		return nil, fmt.Errorf("resposta muito curta: %d bytes", n)
	}
	if buf[7]&0x80 != 0 {
		return nil, fmt.Errorf("excecao modbus: %d", buf[8])
	}

	return buf[9 : 9+int(buf[8])], nil
}

func (c *modbusClient) readRegisterRaw(slaveID byte, addr uint16) ([]byte, error) {
	if c.rawConn == nil {
		return nil, fmt.Errorf("sem conexao")
	}
	c.rawConn.SetDeadline(time.Now().Add(c.timeout))

	request := []byte{slaveID, 0x03, byte(addr >> 8), byte(addr & 0xFF), 0x00, 0x01}
	crc := modbusCRC(request)
	request = append(request, byte(crc), byte(crc>>8))

	if _, err := c.rawConn.Write(request); err != nil {
		return nil, fmt.Errorf("erro ao escrever: %w", err)
	}

	buf := make([]byte, 256)
	n, err := c.rawConn.Read(buf)
	if err != nil {
		return nil, fmt.Errorf("erro ao ler: %w", err)
	}
	if n < 5 {
		return nil, fmt.Errorf("resposta muito curta: %d bytes", n)
	}

	expectedCRC := modbusCRC(buf[:n-2])
	receivedCRC := binary.LittleEndian.Uint16(buf[n-2 : n])
	if expectedCRC != receivedCRC {
		return nil, fmt.Errorf("CRC invalido")
	}

	if buf[1]&0x80 != 0 {
		return nil, fmt.Errorf("excecao modbus: %d", buf[2])
	}

	return buf[3 : 3+buf[2]], nil
}

func (c *modbusClient) Close() error {
	var err error
	if c.rawConn != nil {
		err = c.rawConn.Close()
		c.rawConn = nil
	}
	if c.mode == "tcp" && c.tcp != nil {
		c.tcpActive = false
		err = c.tcp.Close()
		c.tcp = nil
	}
	if c.rtu != nil {
		err = c.rtu.Close()
		c.rtu = nil
	}
	if c.holdingSerialMu {
		serialMu.Unlock()
		c.holdingSerialMu = false
	}
	return err
}

func decodeRegister(data []byte, index int) float64 {
	offset := index * 2
	if offset+1 >= len(data) {
		return 0
	}
	raw := int16(binary.BigEndian.Uint16(data[offset : offset+2]))
	return math.Round(float64(raw)/FatorDivisao*100) / 100
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
