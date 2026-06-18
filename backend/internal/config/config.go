package config

import (
	"fmt"

	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
)

type Config struct {
	ModbusPort     string
	ModbusBaudrate int
	ModbusParity   string
	ModbusStopbits int
	ModbusTimeout  int

	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string

	ServerPort   string
	ReadInterval int
}

var AppConfig *Config

func LoadConfig() *Config {
	viper.SetConfigFile(".env")
	viper.SetConfigType("env")
	viper.AutomaticEnv()

	viper.SetDefault("MODBUS_PORT", "COM3")
	viper.SetDefault("MODBUS_BAUDRATE", 9600)
	viper.SetDefault("MODBUS_PARITY", "E")
	viper.SetDefault("MODBUS_STOPBITS", 1)
	viper.SetDefault("MODBUS_TIMEOUT", 2)

	viper.SetDefault("DB_HOST", "localhost")
	viper.SetDefault("DB_PORT", "5432")
	viper.SetDefault("DB_USER", "postgres")
	viper.SetDefault("DB_PASSWORD", "postgres")
	viper.SetDefault("DB_NAME", "dixell_monitor")

	viper.SetDefault("SERVER_PORT", "8080")
	viper.SetDefault("READ_INTERVAL", 60)

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			logrus.Warn("arquivo .env nao encontrado, usando variaveis de ambiente e defaults")
		} else {
			logrus.Warnf("erro ao ler .env, usando defaults: %v", err)
		}
	}

	cfg := &Config{
		ModbusPort:     viper.GetString("MODBUS_PORT"),
		ModbusBaudrate: viper.GetInt("MODBUS_BAUDRATE"),
		ModbusParity:   viper.GetString("MODBUS_PARITY"),
		ModbusStopbits: viper.GetInt("MODBUS_STOPBITS"),
		ModbusTimeout:  viper.GetInt("MODBUS_TIMEOUT"),

		DBHost:     viper.GetString("DB_HOST"),
		DBPort:     viper.GetString("DB_PORT"),
		DBUser:     viper.GetString("DB_USER"),
		DBPassword: viper.GetString("DB_PASSWORD"),
		DBName:     viper.GetString("DB_NAME"),

		ServerPort:   viper.GetString("SERVER_PORT"),
		ReadInterval: viper.GetInt("READ_INTERVAL"),
	}

	AppConfig = cfg
	return cfg
}

func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName,
	)
}
