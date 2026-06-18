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
	"dixell-monitor/internal/repositories"
	"dixell-monitor/internal/scheduler"
	"dixell-monitor/internal/services"

	"github.com/sirupsen/logrus"
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

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sched := scheduler.NewScheduler(monitorService, time.Duration(cfg.ReadInterval)*time.Second)
	go sched.Start(ctx)

	router := api.SetupRouter(maquinaHandler, leituraHandler)

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
