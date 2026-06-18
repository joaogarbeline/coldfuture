package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dixell-monitor/internal/models"
	"dixell-monitor/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

type LeituraHandler struct {
	service  services.LeituraService
	monitor  services.MonitorService
	log      *logrus.Entry
}

func NewLeituraHandler(service services.LeituraService, monitor services.MonitorService) *LeituraHandler {
	return &LeituraHandler{
		service: service,
		monitor: monitor,
		log:     logrus.WithField("handler", "leitura"),
	}
}

func (h *LeituraHandler) Listar(c *gin.Context) {
	limit, offset := parsePagination(c)

	leituras, err := h.service.Listar(limit, offset)
	if err != nil {
		h.log.Errorf("erro ao listar leituras: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao listar leituras"})
		return
	}

	c.JSON(http.StatusOK, leituras)
}

func (h *LeituraHandler) ListarPorMaquina(c *gin.Context) {
	maquinaID, err := strconv.ParseUint(c.Param("maquinaId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id da maquina invalido"})
		return
	}

	limit, offset := parsePagination(c)

	leituras, err := h.service.ListarPorMaquina(uint(maquinaID), limit, offset)
	if err != nil {
		h.log.Errorf("erro ao listar leituras por maquina: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao listar leituras"})
		return
	}

	c.JSON(http.StatusOK, leituras)
}

func (h *LeituraHandler) BuscarUltima(c *gin.Context) {
	maquinaID, err := strconv.ParseUint(c.Param("maquinaId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id da maquina invalido"})
		return
	}

	leitura, err := h.service.BuscarUltima(uint(maquinaID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "nenhuma leitura encontrada"})
		return
	}

	c.JSON(http.StatusOK, leitura)
}

func (h *LeituraHandler) BuscarCache(c *gin.Context) {
	cache := h.monitor.ObterCache()
	result := make(map[uint]gin.H)
	for id, l := range cache {
		result[id] = gin.H{
			"temperatura":    l.Temperatura,
			"umidade":        l.Umidade,
			"data_hora":      l.DataHora,
			"ultima_leitura": l.UltimaLeitura,
			"stale":          l.Stale,
		}
	}
	c.JSON(http.StatusOK, result)
}

func (h *LeituraHandler) BuscarPorPeriodo(c *gin.Context) {
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

	var inicio *time.Time
	if ini := c.Query("inicio"); ini != "" {
		t, err := time.Parse(time.RFC3339, ini)
		if err != nil {
			t, err = time.Parse("2006-01-02T15:04:05", ini)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "formato de data inicio invalido. Use RFC3339 ou YYYY-MM-DDTHH:MM:SS"})
				return
			}
		}
		loc := time.Local
		t = t.In(loc)
		inicio = &t
	}

	var fim *time.Time
	if f := c.Query("fim"); f != "" {
		t, err := time.Parse(time.RFC3339, f)
		if err != nil {
			t, err = time.Parse("2006-01-02T15:04:05", f)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "formato de data fim invalido. Use RFC3339 ou YYYY-MM-DDTHH:MM:SS"})
				return
			}
		}
		loc := time.Local
		t = t.In(loc)
		fim = &t
	}

	limit, offset := parsePagination(c)

	leituras, err := h.service.BuscarPorPeriodo(maquinaID, inicio, fim, limit, offset)
	if err != nil {
		h.log.Errorf("erro ao buscar leituras por periodo: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar leituras"})
		return
	}

	c.JSON(http.StatusOK, leituras)
}

func (h *LeituraHandler) BuscarEstatisticas(c *gin.Context) {
	maquinaID, err := strconv.ParseUint(c.Param("maquinaId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id da maquina invalido"})
		return
	}

	stats, err := h.service.BuscarEstatisticas(uint(maquinaID))
	if err != nil {
		h.log.Errorf("erro ao buscar estatisticas: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar estatisticas"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

func (h *LeituraHandler) BuscarEstatisticasDiarias(c *gin.Context) {
	maquinaID, err := strconv.ParseUint(c.Param("maquinaId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id da maquina invalido"})
		return
	}

	dataStr := c.Query("data")
	if dataStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "parametro data obrigatorio (YYYY-MM-DD)"})
		return
	}

	loc := time.Local
	data, err := time.ParseInLocation("2006-01-02", dataStr, loc)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "formato de data invalido. Use YYYY-MM-DD"})
		return
	}

	stats, err := h.service.BuscarEstatisticasDiarias(uint(maquinaID), data)
	if err != nil {
		h.log.Errorf("erro ao buscar estatisticas diarias: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar estatisticas diarias"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

func (h *LeituraHandler) BuscarPorPeriodoMultiplas(c *gin.Context) {
	maquinasStr := c.Query("maquinas")
	if maquinasStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "parametro maquinas obrigatorio (IDs separados por virgula)"})
		return
	}

	idsStr := strings.Split(maquinasStr, ",")
	maquinaIDs := make([]uint, 0, len(idsStr))
	for _, s := range idsStr {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		id, err := strconv.ParseUint(s, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id de maquina invalido: " + s})
			return
		}
		maquinaIDs = append(maquinaIDs, uint(id))
	}

	var inicio *time.Time
	if ini := c.Query("inicio"); ini != "" {
		t, err := time.Parse(time.RFC3339, ini)
		if err != nil {
			t, err = time.Parse("2006-01-02T15:04:05", ini)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "formato de data inicio invalido. Use RFC3339 ou YYYY-MM-DDTHH:MM:SS"})
				return
			}
		}
		loc := time.Local
		t = t.In(loc)
		inicio = &t
	}

	var fim *time.Time
	if f := c.Query("fim"); f != "" {
		t, err := time.Parse(time.RFC3339, f)
		if err != nil {
			t, err = time.Parse("2006-01-02T15:04:05", f)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "formato de data fim invalido. Use RFC3339 ou YYYY-MM-DDTHH:MM:SS"})
				return
			}
		}
		loc := time.Local
		t = t.In(loc)
		fim = &t
	}

	limit, offset := parsePagination(c)

	leituras, err := h.service.BuscarPorPeriodoMultiplasMaquinas(maquinaIDs, inicio, fim, limit, offset)
	if err != nil {
		h.log.Errorf("erro ao buscar leituras por periodo multiplas: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar leituras"})
		return
	}

	c.JSON(http.StatusOK, leituras)
}

func (h *LeituraHandler) BuscarResumoDiarioHoje(c *gin.Context) {
	resumo, err := h.service.BuscarResumoDiarioHoje()
	if err != nil {
		h.log.Errorf("erro ao buscar resumo diario: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar resumo diario"})
		return
	}
	c.JSON(http.StatusOK, resumo)
}

func (h *LeituraHandler) BuscarResumoDiarioPeriodo(c *gin.Context) {
	var inicio *time.Time
	if ini := c.Query("inicio"); ini != "" {
		loc := time.Local
		t, err := time.ParseInLocation("2006-01-02", ini, loc)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "formato de data inicio invalido. Use YYYY-MM-DD"})
			return
		}
		inicio = &t
	}

	var fim *time.Time
	if f := c.Query("fim"); f != "" {
		loc := time.Local
		t, err := time.ParseInLocation("2006-01-02", f, loc)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "formato de data fim invalido. Use YYYY-MM-DD"})
			return
		}
		fim = &t
	}

	var maquinaIDs []uint
	if maqs := c.Query("maquinas"); maqs != "" {
		for _, s := range strings.Split(maqs, ",") {
			s = strings.TrimSpace(s)
			if s == "" {
				continue
			}
			id, err := strconv.ParseUint(s, 10, 32)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "id de maquina invalido: " + s})
				return
			}
			maquinaIDs = append(maquinaIDs, uint(id))
		}
	}

	resumo, err := h.service.BuscarResumoDiarioPeriodo(maquinaIDs, inicio, fim)
	if err != nil {
		h.log.Errorf("erro ao buscar resumo diario periodo: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar resumo diario"})
		return
	}

	c.JSON(http.StatusOK, resumo)
}

func (h *LeituraHandler) ExportarCSV(c *gin.Context) {
	var maquinaIDs []uint

	if mid := c.Query("maquina"); mid != "" {
		id, err := strconv.ParseUint(mid, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "parametro maquina invalido"})
			return
		}
		maquinaIDs = append(maquinaIDs, uint(id))
	}

	if maqs := c.Query("maquinas"); maqs != "" {
		for _, s := range strings.Split(maqs, ",") {
			s = strings.TrimSpace(s)
			if s == "" {
				continue
			}
			id, err := strconv.ParseUint(s, 10, 32)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "id de maquina invalido: " + s})
				return
			}
			maquinaIDs = append(maquinaIDs, uint(id))
		}
	}

	var inicio *time.Time
	if ini := c.Query("inicio"); ini != "" {
		t, err := time.Parse(time.RFC3339, ini)
		if err != nil {
			t, err = time.Parse("2006-01-02T15:04:05", ini)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "formato de data inicio invalido. Use RFC3339 ou YYYY-MM-DDTHH:MM:SS"})
				return
			}
		}
		loc := time.Local
		t = t.In(loc)
		inicio = &t
	}

	var fim *time.Time
	if f := c.Query("fim"); f != "" {
		t, err := time.Parse(time.RFC3339, f)
		if err != nil {
			t, err = time.Parse("2006-01-02T15:04:05", f)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "formato de data fim invalido. Use RFC3339 ou YYYY-MM-DDTHH:MM:SS"})
				return
			}
		}
		loc := time.Local
		t = t.In(loc)
		fim = &t
	}

	limit, offset := parsePagination(c)
	limit = 50000

	var leituras []models.Leitura
	var err error
	if len(maquinaIDs) > 1 {
		leituras, err = h.service.BuscarPorPeriodoMultiplasMaquinas(maquinaIDs, inicio, fim, limit, offset)
	} else {
		var singleID *uint
		if len(maquinaIDs) == 1 {
			singleID = &maquinaIDs[0]
		}
		leituras, err = h.service.BuscarPorPeriodo(singleID, inicio, fim, limit, offset)
	}

	if err != nil {
		h.log.Errorf("erro ao exportar CSV: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao gerar CSV"})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=leituras.csv")
	c.Header("Content-Transfer-Encoding", "binary")

	c.Writer.WriteString("\xEF\xBB\xBF")
	c.Writer.WriteString("Data Hora;Nome Maquina;Temperatura (C);Umidade (%)\r\n")

	for _, l := range leituras {
		dataHora := l.DataHora.Format("2006-01-02 15:04:05")
		nomeMaquina := ""
		if l.Maquina.Nome != "" {
			nomeMaquina = l.Maquina.Nome
		}
		tempStr := ""
		if l.Temperatura != nil {
			tempStr = fmt.Sprintf("%.0f", *l.Temperatura)
		}
		umidStr := ""
		if l.Umidade != nil {
			umidStr = fmt.Sprintf("%.0f", *l.Umidade)
		}
		c.Writer.WriteString(fmt.Sprintf("%s;%s;%s;%s\r\n",
			dataHora, nomeMaquina, tempStr, umidStr))
	}
}

func parsePagination(c *gin.Context) (int, int) {
	limit := 100
	offset := 0

	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 100000 {
			limit = v
		}
	}

	if o := c.Query("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}

	return limit, offset
}


