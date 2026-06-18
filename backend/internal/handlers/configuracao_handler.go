package handlers

import (
	"fmt"
	"net/http"

	"dixell-monitor/internal/models"
	"dixell-monitor/internal/repositories"

	"github.com/gin-gonic/gin"
)

type ConfiguracaoHandler struct {
	repo repositories.ConfiguracaoRepository
}

func NewConfiguracaoHandler(repo repositories.ConfiguracaoRepository) *ConfiguracaoHandler {
	return &ConfiguracaoHandler{repo: repo}
}

func (h *ConfiguracaoHandler) Buscar(c *gin.Context) {
	todas, err := h.repo.BuscarTodas()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar configuracoes"})
		return
	}
	if todas == nil {
		todas = make(map[string]string)
	}
	c.JSON(http.StatusOK, todas)
}

func (h *ConfiguracaoHandler) Salvar(c *gin.Context) {
	var req models.ConfiguracaoSistemaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dados invalidos"})
		return
	}

	if req.ModbusModo != "" {
		if err := h.repo.Salvar("modbus_modo", req.ModbusModo); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao salvar"})
			return
		}
	}
	if req.ModbusTCPHost != "" {
		if err := h.repo.Salvar("modbus_tcp_host", req.ModbusTCPHost); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao salvar"})
			return
		}
	}
	if req.ModbusTCPPort > 0 {
		if err := h.repo.Salvar("modbus_tcp_port", fmt.Sprintf("%d", req.ModbusTCPPort)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao salvar"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

