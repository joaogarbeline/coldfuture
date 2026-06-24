package handlers

import (
	"net/http"
	"strconv"

	"dixell-monitor/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

type ControleHandler struct {
	service services.ControleService
	log     *logrus.Entry
}

func NewControleHandler(service services.ControleService) *ControleHandler {
	return &ControleHandler{
		service: service,
		log:     logrus.WithField("handler", "controle"),
	}
}

type EnviarComandoRequest struct {
	Tipo  string `json:"tipo" binding:"required"`
	Valor string `json:"valor"`
}

type AlterarSetpointRequest struct {
	Tipo  string  `json:"tipo" binding:"required"`
	Valor float64 `json:"valor" binding:"required"`
}

func (h *ControleHandler) EnviarComando(c *gin.Context) {
	maquinaID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id da maquina invalido"})
		return
	}

	var req EnviarComandoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dados invalidos: " + err.Error()})
		return
	}

	comando, err := h.service.EnviarComando(uint(maquinaID), req.Tipo, req.Valor)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	status := http.StatusOK
	if !comando.Sucesso {
		status = http.StatusBadGateway
	}
	c.JSON(status, comando)
}

func (h *ControleHandler) LerStatusControle(c *gin.Context) {
	maquinaID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id da maquina invalido"})
		return
	}

	status, err := h.service.LerStatusControle(uint(maquinaID))
	if err != nil {
		h.log.Errorf("erro ao ler status controle: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, status)
}

func (h *ControleHandler) LerSetpoints(c *gin.Context) {
	maquinaID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id da maquina invalido"})
		return
	}

	setpoints, err := h.service.LerSetpoints(uint(maquinaID))
	if err != nil {
		h.log.Errorf("erro ao ler setpoints: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, setpoints)
}

func (h *ControleHandler) AlterarSetpoint(c *gin.Context) {
	maquinaID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id da maquina invalido"})
		return
	}

	var req AlterarSetpointRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dados invalidos: " + err.Error()})
		return
	}

	comando, err := h.service.AlterarSetpoint(uint(maquinaID), req.Tipo, req.Valor)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	status := http.StatusOK
	if !comando.Sucesso {
		status = http.StatusBadGateway
	}
	c.JSON(status, comando)
}

func (h *ControleHandler) ListarComandos(c *gin.Context) {
	var maquinaID *uint
	if mid := c.Query("maquina"); mid != "" {
		id, err := strconv.ParseUint(mid, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "parametro maquina invalido"})
			return
		}
		uid := uint(id)
		maquinaID = &uid
	}

	limit := 50
	offset := 0
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 500 {
			limit = v
		}
	}
	if o := c.Query("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}

	comandos, err := h.service.ListarComandos(maquinaID, limit, offset)
	if err != nil {
		h.log.Errorf("erro ao listar comandos: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao listar comandos"})
		return
	}

	c.JSON(http.StatusOK, comandos)
}
