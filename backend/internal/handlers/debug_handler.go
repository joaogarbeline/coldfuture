package handlers

import (
	"net/http"
	"strconv"
	"time"

	"dixell-monitor/internal/config"
	"dixell-monitor/internal/modbus"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

type DebugHandler struct {
	cfg *config.Config
	log *logrus.Entry
}

func NewDebugHandler(cfg *config.Config) *DebugHandler {
	return &DebugHandler{
		cfg: cfg,
		log: logrus.WithField("handler", "debug"),
	}
}

func (h *DebugHandler) LerRegistradores(c *gin.Context) {
	maquinaID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalido"})
		return
	}

	client := modbus.NewClient(h.cfg)
	defer client.Close()

	slaveID := byte(maquinaID)

	r1280, err1280 := client.ReadHoldingRegister(slaveID, 1280)
	time.Sleep(300 * time.Millisecond)
	r32889, err32889 := client.ReadHoldingRegister(slaveID, 32889)
	time.Sleep(300 * time.Millisecond)
	r32891, err32891 := client.ReadHoldingRegister(slaveID, 32891)
	time.Sleep(300 * time.Millisecond)
	r32895, err32895 := client.ReadHoldingRegister(slaveID, 32895)
	time.Sleep(300 * time.Millisecond)
	r839, err839 := client.ReadHoldingRegister(slaveID, 839)
	time.Sleep(300 * time.Millisecond)
	r840, err840 := client.ReadHoldingRegister(slaveID, 840)

	errs := gin.H{}
	if err1280 != nil {
		errs["1280"] = err1280.Error()
	}
	if err32889 != nil {
		errs["32889"] = err32889.Error()
	}
	if err32891 != nil {
		errs["32891"] = err32891.Error()
	}
	if err32895 != nil {
		errs["32895"] = err32895.Error()
	}
	if err839 != nil {
		errs["839"] = err839.Error()
	}
	if err840 != nil {
		errs["840"] = err840.Error()
	}

	c.JSON(http.StatusOK, gin.H{
		"slave_id": maquinaID,
		"registradores": gin.H{
			"1280_comando":      r1280,
			"32889_onoff":       r32889,
			"32891_reles":       r32891,
			"32895_alarmes":     r32895,
			"839_setpoint_temp": r839,
			"840_setpoint_umid": r840,
		},
		"erros": errs,
	})
}

func (h *DebugHandler) TestarComando(c *gin.Context) {
	maquinaID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalido"})
		return
	}

	valorStr := c.Query("valor")
	if valorStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "parametro 'valor' obrigatorio"})
		return
	}

	valor, err := strconv.ParseUint(valorStr, 10, 16)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valor invalido"})
		return
	}

	client := modbus.NewClient(h.cfg)
	defer client.Close()

	slaveID := byte(maquinaID)

	r1280Antes, _ := client.ReadHoldingRegister(slaveID, 1280)
	r32889Antes, _ := client.ReadHoldingRegister(slaveID, 32889)
	r32891Antes, _ := client.ReadHoldingRegister(slaveID, 32891)

	err = client.WriteSingleRegister(slaveID, 1280, uint16(valor))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao escrever: " + err.Error()})
		return
	}

	time.Sleep(500 * time.Millisecond)

	r1280Depois, _ := client.ReadHoldingRegister(slaveID, 1280)
	r32889Depois, _ := client.ReadHoldingRegister(slaveID, 32889)
	r32891Depois, _ := client.ReadHoldingRegister(slaveID, 32891)

	c.JSON(http.StatusOK, gin.H{
		"slave_id":      maquinaID,
		"valor_enviado": valor,
		"antes": gin.H{
			"1280":  r1280Antes,
			"32889": r32889Antes,
			"32891": r32891Antes,
		},
		"depois": gin.H{
			"1280":  r1280Depois,
			"32889": r32889Depois,
			"32891": r32891Depois,
		},
	})
}

func (h *DebugHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":      "ok",
		"modbus_mode": h.cfg.ModbusMode,
		"modbus_port": h.cfg.ModbusPort,
	})
}
