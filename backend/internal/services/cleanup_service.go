package services

import (
	"encoding/csv"
	"fmt"
	"os"
	"time"

	"dixell-monitor/internal/models"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

func LimparLeiturasAntigas(db *gorm.DB) {
	log := logrus.WithField("service", "cleanup")

	corte := time.Now().AddDate(0, 0, -90)

	var leituras []models.Leitura
	if err := db.Preload("Maquina").Where("data_hora < ?", corte).Find(&leituras).Error; err != nil {
		log.Errorf("erro ao buscar leituras antigas: %v", err)
		return
	}

	if len(leituras) == 0 {
		log.Info("nenhuma leitura antiga para limpar")
		return
	}

	if err := os.MkdirAll("./backups", 0755); err != nil {
		log.Errorf("erro ao criar diretorio backups: %v", err)
		return
	}

	filename := fmt.Sprintf("./backups/leituras_backup_%s.csv", time.Now().Format("2006-01-02"))
	file, err := os.Create(filename)
	if err != nil {
		log.Errorf("erro ao criar arquivo CSV: %v", err)
		return
	}
	defer file.Close()

	file.WriteString("\xEF\xBB\xBF")

	writer := csv.NewWriter(file)
	writer.Comma = ';'
	defer writer.Flush()

	writer.Write([]string{"Data Hora", "Nome Maquina", "Temperatura (C)", "Umidade (%)"})

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
		writer.Write([]string{dataHora, nomeMaquina, tempStr, umidStr})
	}

	writer.Flush()
	log.Infof("backup CSV criado: %s com %d leituras", filename, len(leituras))

	if err := db.Where("data_hora < ?", corte).Delete(&models.Leitura{}).Error; err != nil {
		log.Errorf("erro ao deletar leituras antigas: %v", err)
		return
	}

	log.Infof("%d leituras antigas removidas", len(leituras))
}
