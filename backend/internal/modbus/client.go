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

type modbusClient struct {
	mode      string
	rtu       *modbus.RTUClientHandler
	tcp       *modbus.TCPClientHandler
	rawConn   net.Conn
	client    modbus.Client
	mu        sync.Mutex
	timeout   time.Duration
	cfg       *config.Config
	tcpActive bool
	log       *logrus.Entry
}

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
		if c.rtu == nil {
			c.rtu = modbus.NewRTUClientHandler(c.cfg.ModbusPort)
			c.rtu.BaudRate = c.cfg.ModbusBaudrate
			c.rtu.DataBits = 8
			c.rtu.Parity = c.cfg.ModbusParity
			c.rtu.StopBits = c.cfg.ModbusStopbits
			c.rtu.Timeout = c.timeout
			if err := c.rtu.Connect(); err != nil {
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

func (c *modbusClient) ReadRegisters(slaveID byte) (*DixellReading, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.connect(); err != nil {
		return nil, err
	}

	if c.mode == "tcp" || c.mode == "rtu" {
		if c.mode == "tcp" {
			c.tcp.SlaveId = slaveID
		} else {
			c.rtu.SlaveId = slaveID
		}

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

	reading := &DixellReading{}

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

func (c *modbusClient) Close() error {
	if c.rawConn != nil {
		return c.rawConn.Close()
	}
	if c.mode == "tcp" && c.tcp != nil {
		c.tcpActive = false
		return c.tcp.Close()
	}
	if c.rtu != nil {
		return c.rtu.Close()
	}
	return nil
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
