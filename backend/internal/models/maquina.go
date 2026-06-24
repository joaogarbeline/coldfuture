package models

import (
	"time"

	"gorm.io/gorm"
)

type Maquina struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	Nome            string    `gorm:"type:varchar(100)" json:"nome"`
	EnderecoModbus  int       `gorm:"uniqueIndex;column:endereco_modbus" json:"endereco_modbus"`
	Ativo           bool      `gorm:"default:true" json:"ativo"`
	SetpointTempMax *float64  `gorm:"type:numeric(8,2);column:setpoint_temp_max" json:"setpoint_temp_max"`
	SetpointTempMin *float64  `gorm:"type:numeric(8,2);column:setpoint_temp_min" json:"setpoint_temp_min"`
	SetpointUmidMax *float64  `gorm:"type:numeric(8,2);column:setpoint_umid_max" json:"setpoint_umid_max"`
	SetpointUmidMin *float64  `gorm:"type:numeric(8,2);column:setpoint_umid_min" json:"setpoint_umid_min"`
	Leituras        []Leitura `gorm:"foreignKey:MaquinaID" json:"leituras,omitempty"`
}

type MaquinaSetpoints struct {
	SetpointTempMax *float64 `json:"setpoint_temp_max"`
	SetpointTempMin *float64 `json:"setpoint_temp_min"`
	SetpointUmidMax *float64 `json:"setpoint_umid_max"`
	SetpointUmidMin *float64 `json:"setpoint_umid_min"`
}

func (Maquina) TableName() string {
	return "maquinas"
}

type Leitura struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	MaquinaID          uint      `gorm:"index;column:maquina_id" json:"maquina_id"`
	Temperatura        *float64  `gorm:"type:numeric(8,2)" json:"temperatura"`
	Umidade            *float64  `gorm:"type:numeric(8,2)" json:"umidade"`
	SetpointTemperatura *float64 `gorm:"type:numeric(8,2);column:setpoint_temperatura" json:"setpoint_temperatura"`
	SetpointUmidade    *float64  `gorm:"type:numeric(8,2);column:setpoint_umidade" json:"setpoint_umidade"`
	Alarmes            *int      `gorm:"type:integer" json:"alarmes"`
	Status             *int      `gorm:"type:integer" json:"status"`
	DataHora           time.Time `gorm:"default:now();column:data_hora" json:"data_hora"`
	Maquina            Maquina   `gorm:"foreignKey:MaquinaID" json:"maquina,omitempty"`
}

func (Leitura) TableName() string {
	return "leituras"
}

type ResumoDiario struct {
	Data      string   `json:"data"`
	MaquinaID uint     `json:"maquina_id"`
	TempMin   *float64 `json:"temp_min"`
	TempMax   *float64 `json:"temp_max"`
	TempAvg   *float64 `json:"temp_avg"`
	UmidMin   *float64 `json:"umid_min"`
	UmidMax   *float64 `json:"umid_max"`
	UmidAvg   *float64 `json:"umid_avg"`
}

type EstatisticaDiaria struct {
	Hora           int      `json:"hora"`
	TemperaturaMax *float64 `json:"temperatura_max"`
	TemperaturaMin *float64 `json:"temperatura_min"`
	TemperaturaAvg *float64 `json:"temperatura_media"`
	UmidadeMax     *float64 `json:"umidade_max"`
	UmidadeMin     *float64 `json:"umidade_min"`
	UmidadeAvg     *float64 `json:"umidade_media"`
}

type Estatisticas struct {
	TemperaturaMax *float64 `json:"temperatura_max"`
	TemperaturaMin *float64 `json:"temperatura_min"`
	TemperaturaAvg *float64 `json:"temperatura_media"`
	UmidadeMax     *float64 `json:"umidade_max"`
	UmidadeMin     *float64 `json:"umidade_min"`
	UmidadeAvg     *float64 `json:"umidade_media"`
}

type LeituraFiltro struct {
	MaquinaID *uint
	Inicio    *time.Time
	Fim       *time.Time
}

type Comando struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	MaquinaID uint      `gorm:"index;column:maquina_id" json:"maquina_id"`
	Tipo      string    `gorm:"type:varchar(50)" json:"tipo"`
	Valor     string    `gorm:"type:varchar(50)" json:"valor"`
	Sucesso   bool      `gorm:"default:false" json:"sucesso"`
	Mensagem  string    `gorm:"type:text" json:"mensagem"`
	DataHora  time.Time `gorm:"default:now();column:data_hora" json:"data_hora"`
	Maquina   Maquina   `gorm:"foreignKey:MaquinaID" json:"maquina,omitempty"`
}

func (Comando) TableName() string {
	return "comandos"
}

func (f *LeituraFiltro) Apply(db *gorm.DB) *gorm.DB {
	if f.MaquinaID != nil {
		db = db.Where("maquina_id = ?", *f.MaquinaID)
	}
	if f.Inicio != nil {
		db = db.Where("data_hora >= ?", *f.Inicio)
	}
	if f.Fim != nil {
		db = db.Where("data_hora <= ?", *f.Fim)
	}
	return db
}
