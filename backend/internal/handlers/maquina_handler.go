package handlers

import (
	"net/http"
	"strconv"

	"dixell-monitor/internal/config"
	"dixell-monitor/internal/models"
	"dixell-monitor/internal/modbus"
	"dixell-monitor/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

type MaquinaHandler struct {
	service services.MaquinaService
	cfg     *config.Config
	log     *logrus.Entry
}

func NewMaquinaHandler(service services.MaquinaService, cfg *config.Config) *MaquinaHandler {
	return &MaquinaHandler{
		service: service,
		cfg:     cfg,
		log:     logrus.WithField("handler", "maquina"),
	}
}

type CriarMaquinaRequest struct {
	Nome            string   `json:"nome" binding:"required"`
	EnderecoModbus  int      `json:"endereco_modbus" binding:"required"`
	SetpointTempMax *float64 `json:"setpoint_temp_max"`
	SetpointTempMin *float64 `json:"setpoint_temp_min"`
	SetpointUmidMax *float64 `json:"setpoint_umid_max"`
	SetpointUmidMin *float64 `json:"setpoint_umid_min"`
}

type AtualizarMaquinaRequest struct {
	Nome            string   `json:"nome" binding:"required"`
	EnderecoModbus  int      `json:"endereco_modbus" binding:"required"`
	Ativo           bool     `json:"ativo"`
	SetpointTempMax *float64 `json:"setpoint_temp_max"`
	SetpointTempMin *float64 `json:"setpoint_temp_min"`
	SetpointUmidMax *float64 `json:"setpoint_umid_max"`
	SetpointUmidMin *float64 `json:"setpoint_umid_min"`
}

func (h *MaquinaHandler) Listar(c *gin.Context) {
	maquinas, err := h.service.Listar()
	if err != nil {
		h.log.Errorf("erro ao listar maquinas: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao listar maquinas"})
		return
	}
	c.JSON(http.StatusOK, maquinas)
}

func (h *MaquinaHandler) BuscarPorID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalido"})
		return
	}

	maquina, err := h.service.BuscarPorID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "maquina nao encontrada"})
		return
	}

	c.JSON(http.StatusOK, maquina)
}

func (h *MaquinaHandler) Criar(c *gin.Context) {
	var req CriarMaquinaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dados invalidos: " + err.Error()})
		return
	}

	setpoints := &models.MaquinaSetpoints{
		SetpointTempMax: req.SetpointTempMax,
		SetpointTempMin: req.SetpointTempMin,
		SetpointUmidMax: req.SetpointUmidMax,
		SetpointUmidMin: req.SetpointUmidMin,
	}

	maquina, err := h.service.Criar(req.Nome, req.EnderecoModbus, setpoints)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, maquina)
}

func (h *MaquinaHandler) Atualizar(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalido"})
		return
	}

	var req AtualizarMaquinaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dados invalidos: " + err.Error()})
		return
	}

	setpoints := &models.MaquinaSetpoints{
		SetpointTempMax: req.SetpointTempMax,
		SetpointTempMin: req.SetpointTempMin,
		SetpointUmidMax: req.SetpointUmidMax,
		SetpointUmidMin: req.SetpointUmidMin,
	}

	maquina, err := h.service.Atualizar(uint(id), req.Nome, req.EnderecoModbus, req.Ativo, setpoints)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, maquina)
}

func (h *MaquinaHandler) Remover(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalido"})
		return
	}

	if err := h.service.Remover(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "maquina removida com sucesso"})
}

func (h *MaquinaHandler) AtualizarSetpoints(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalido"})
		return
	}

	var req models.MaquinaSetpoints
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dados invalidos: " + err.Error()})
		return
	}

	maquina, err := h.service.AtualizarSetpoints(uint(id), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, maquina)
}

func (h *MaquinaHandler) Descobrir(c *gin.Context) {
	client := modbus.NewClient(
		h.cfg.ModbusPort,
		h.cfg.ModbusBaudrate,
		h.cfg.ModbusParity,
		h.cfg.ModbusStopbits,
		h.cfg.ModbusTimeout,
	)
	defer client.Close()

	descobertos := make([]int, 0)

	for addr := 1; addr <= 10; addr++ {
		_, err := client.ReadRegisters(byte(addr))
		if err == nil {
			descobertos = append(descobertos, addr)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"encontrados": len(descobertos),
		"enderecos":   descobertos,
	})
}
