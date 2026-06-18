package database

import (
	"fmt"
	"time"

	"dixell-monitor/internal/config"

	"github.com/sirupsen/logrus"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect(cfg *config.Config) (*gorm.DB, error) {
	dsn := cfg.DSN()

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao conectar ao PostgreSQL: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("falha ao obter conexao SQL: %w", err)
	}

	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	logrus.Info("conectado ao PostgreSQL com sucesso")
	return db, nil
}

func RunMigrations(db *gorm.DB) error {
	logrus.Info("executando migracoes...")

	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS maquinas (
			id SERIAL PRIMARY KEY,
			nome VARCHAR(100),
			endereco_modbus INTEGER UNIQUE,
			ativo BOOLEAN DEFAULT TRUE
		)
	`).Error; err != nil {
		return fmt.Errorf("erro ao criar tabela maquinas: %w", err)
	}

	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS leituras (
			id BIGSERIAL PRIMARY KEY,
			maquina_id INTEGER REFERENCES maquinas(id) ON DELETE CASCADE,
			temperatura NUMERIC(8,2),
			umidade NUMERIC(8,2),
			setpoint_temperatura NUMERIC(8,2),
			setpoint_umidade NUMERIC(8,2),
			alarmes INTEGER,
			status INTEGER,
			data_hora TIMESTAMP DEFAULT NOW()
		)
	`).Error; err != nil {
		return fmt.Errorf("erro ao criar tabela leituras: %w", err)
	}

	if err := db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_leituras_maquina_data
		ON leituras (maquina_id, data_hora DESC)
	`).Error; err != nil {
		return fmt.Errorf("erro ao criar indice: %w", err)
	}

	if err := db.Exec(`
		ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS setpoint_temp_max NUMERIC(8,2)
	`).Error; err != nil {
		return fmt.Errorf("erro ao adicionar coluna setpoint_temp_max: %w", err)
	}

	if err := db.Exec(`
		ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS setpoint_temp_min NUMERIC(8,2)
	`).Error; err != nil {
		return fmt.Errorf("erro ao adicionar coluna setpoint_temp_min: %w", err)
	}

	if err := db.Exec(`
		ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS setpoint_umid_max NUMERIC(8,2)
	`).Error; err != nil {
		return fmt.Errorf("erro ao adicionar coluna setpoint_umid_max: %w", err)
	}

	if err := db.Exec(`
		ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS setpoint_umid_min NUMERIC(8,2)
	`).Error; err != nil {
		return fmt.Errorf("erro ao adicionar coluna setpoint_umid_min: %w", err)
	}

	if err := db.Exec(`UPDATE leituras SET temperatura = ROUND(temperatura), umidade = ROUND(umidade), setpoint_temperatura = ROUND(setpoint_temperatura), setpoint_umidade = ROUND(setpoint_umidade)`).Error; err != nil {
		logrus.Warnf("aviso ao arredondar leituras existentes: %v", err)
	}

	if err := db.Exec(`ALTER TABLE leituras ALTER COLUMN temperatura TYPE INTEGER USING ROUND(temperatura)::INTEGER`).Error; err != nil {
		logrus.Warnf("aviso ao alterar tipo temperatura: %v", err)
	}
	if err := db.Exec(`ALTER TABLE leituras ALTER COLUMN umidade TYPE INTEGER USING ROUND(umidade)::INTEGER`).Error; err != nil {
		logrus.Warnf("aviso ao alterar tipo umidade: %v", err)
	}
	if err := db.Exec(`ALTER TABLE leituras ALTER COLUMN setpoint_temperatura TYPE INTEGER USING ROUND(setpoint_temperatura)::INTEGER`).Error; err != nil {
		logrus.Warnf("aviso ao alterar tipo setpoint_temperatura: %v", err)
	}
	if err := db.Exec(`ALTER TABLE leituras ALTER COLUMN setpoint_umidade TYPE INTEGER USING ROUND(setpoint_umidade)::INTEGER`).Error; err != nil {
		logrus.Warnf("aviso ao alterar tipo setpoint_umidade: %v", err)
	}
	if err := db.Exec(`ALTER TABLE maquinas ALTER COLUMN setpoint_temp_max TYPE INTEGER USING ROUND(setpoint_temp_max)::INTEGER`).Error; err != nil {
		logrus.Warnf("aviso ao alterar tipo setpoint_temp_max: %v", err)
	}
	if err := db.Exec(`ALTER TABLE maquinas ALTER COLUMN setpoint_temp_min TYPE INTEGER USING ROUND(setpoint_temp_min)::INTEGER`).Error; err != nil {
		logrus.Warnf("aviso ao alterar tipo setpoint_temp_min: %v", err)
	}
	if err := db.Exec(`ALTER TABLE maquinas ALTER COLUMN setpoint_umid_max TYPE INTEGER USING ROUND(setpoint_umid_max)::INTEGER`).Error; err != nil {
		logrus.Warnf("aviso ao alterar tipo setpoint_umid_max: %v", err)
	}
	if err := db.Exec(`ALTER TABLE maquinas ALTER COLUMN setpoint_umid_min TYPE INTEGER USING ROUND(setpoint_umid_min)::INTEGER`).Error; err != nil {
		logrus.Warnf("aviso ao alterar tipo setpoint_umid_min: %v", err)
	}

	if err := db.Exec(`ALTER TABLE leituras ALTER COLUMN data_hora TYPE TIMESTAMPTZ`).Error; err != nil {
		logrus.Warnf("aviso ao alterar tipo data_hora: %v", err)
	}

	logrus.Info("migracoes executadas com sucesso")
	return nil
}
