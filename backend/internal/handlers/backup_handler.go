package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"dixell-monitor/internal/models"
	"dixell-monitor/internal/repositories"

	"github.com/gin-gonic/gin"
)

type BackupHandler struct {
	maqRepo  repositories.MaquinaRepository
	leitRepo repositories.LeituraRepository
}

func NewBackupHandler(maqRepo repositories.MaquinaRepository, leitRepo repositories.LeituraRepository) *BackupHandler {
	return &BackupHandler{
		maqRepo:  maqRepo,
		leitRepo: leitRepo,
	}
}

func (h *BackupHandler) ExportarBackup(c *gin.Context) {
	maquinas, err := h.maqRepo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar maquinas"})
		return
	}

	inicio := time.Now().AddDate(0, 0, -90)
	filtro := &models.LeituraFiltro{
		Inicio: &inicio,
	}
	leituras, err := h.leitRepo.FindByPeriodo(filtro, 100000, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar leituras"})
		return
	}

	backup := gin.H{
		"maquinas":    maquinas,
		"leituras":    leituras,
		"data_export": time.Now().Format("2006-01-02T15:04:05"),
	}

	data, err := json.Marshal(backup)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao gerar JSON"})
		return
	}

	filename := "coldvisio_backup_" + time.Now().Format("2006-01-02") + ".json"
	c.Header("Content-Type", "application/json; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Data(http.StatusOK, "application/json; charset=utf-8", data)
}
