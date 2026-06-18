package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"dixell-monitor/internal/api"
	"dixell-monitor/internal/config"
	"dixell-monitor/internal/database"
	"dixell-monitor/internal/handlers"
	"dixell-monitor/internal/models"
	"dixell-monitor/internal/repositories"
	"dixell-monitor/internal/scheduler"
	"dixell-monitor/internal/services"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// @title Coldvisio API
// @version 1.0
// @description API de monitoramento de temperatura e umidade para controladores XH260 via Modbus RTU
// @host localhost:8080
// @BasePath /api
func main() {
	logrus.SetFormatter(&logrus.JSONFormatter{})
	logrus.SetLevel(logrus.InfoLevel)

	cfg := config.LoadConfig()

	db, err := database.Connect(cfg)
	if err != nil {
		logrus.Fatalf("erro ao conectar ao banco de dados: %v", err)
	}

	if err := database.RunMigrations(db); err != nil {
		logrus.Fatalf("erro ao executar migracoes: %v", err)
	}

	maquinaRepo := repositories.NewMaquinaRepository(db)
	leituraRepo := repositories.NewLeituraRepository(db)

	maquinaService := services.NewMaquinaService(maquinaRepo)
	leituraService := services.NewLeituraService(leituraRepo)

	monitorService := services.NewMonitorService(cfg, maquinaRepo, leituraRepo)

	maquinaHandler := handlers.NewMaquinaHandler(maquinaService, cfg)
	leituraHandler := handlers.NewLeituraHandler(leituraService, monitorService)
	authHandler := handlers.NewAuthHandler()
	backupHandler := handlers.NewBackupHandler(maquinaRepo, leituraRepo)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sched := scheduler.NewScheduler(monitorService, time.Duration(cfg.ReadInterval)*time.Second)
	go sched.Start(ctx)

	go func() {
		for {
			time.Sleep(1 * time.Hour)
			services.LimparLeiturasAntigas(db)
		}
	}()

	go agendarExportDiario(db)

	router := api.SetupRouter(maquinaHandler, leituraHandler, authHandler, backupHandler)

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.ServerPort),
		Handler: router,
	}

	go func() {
		logrus.Infof("servidor iniciado na porta %s", cfg.ServerPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logrus.Fatalf("erro ao iniciar servidor: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logrus.Info("desligando servidor...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logrus.Fatalf("erro ao desligar servidor: %v", err)
	}

	logrus.Info("servidor desligado")
}

func agendarExportDiario(db *gorm.DB) {
	log := logrus.WithField("component", "export-diario")

	for {
		now := time.Now()
		loc := now.Location()
		next := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 0, 0, loc)
		if now.After(next) {
			next = next.Add(24 * time.Hour)
		}
		wait := next.Sub(now)
		log.Infof("proximo export diario agendado para %s (em %s)", next.Format("2006-01-02 15:04:05"), wait.Round(time.Second))

		time.Sleep(wait)

		executarExportDiario(db, log)
	}
}

func executarExportDiario(db *gorm.DB, log *logrus.Entry) {
	now := time.Now()
	loc := now.Location()
	inicio := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	fim := inicio.Add(24 * time.Hour)

	var leituras []models.Leitura
	if err := db.Preload("Maquina").Where("data_hora >= ? AND data_hora < ?", inicio, fim).Order("data_hora ASC").Find(&leituras).Error; err != nil {
		log.Errorf("erro ao buscar leituras para export diario: %v", err)
		return
	}

	if len(leituras) == 0 {
		log.Info("nenhuma leitura para export diario")
		return
	}

	if err := os.MkdirAll("./backups", 0755); err != nil {
		log.Errorf("erro ao criar diretorio backups: %v", err)
		return
	}

	filename := fmt.Sprintf("./backups/diario_%s.csv", now.Format("2006-01-02"))
	file, err := os.Create(filename)
	if err != nil {
		log.Errorf("erro ao criar arquivo CSV: %v", err)
		return
	}
	defer file.Close()

	file.WriteString("\xEF\xBB\xBF")
	file.WriteString("Data Hora;Nome Maquina;Temperatura (C);Umidade (%)\r\n")

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
		file.WriteString(fmt.Sprintf("%s;%s;%s;%s\r\n",
			dataHora, nomeMaquina, tempStr, umidStr))
	}

	log.Infof("export diario concluido: %s com %d leituras", filename, len(leituras))
}
