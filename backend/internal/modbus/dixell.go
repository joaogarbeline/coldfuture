package modbus

var DixellRegisters = struct {
	Temperatura         uint16
	Umidade             uint16
	SetpointTemperatura uint16
	SetpointUmidade     uint16
	Alarmes             uint16
	Status              uint16
}{
	Temperatura:         256,
	Umidade:             260,
	SetpointTemperatura: 0,
	SetpointUmidade:     0,
	Alarmes:             0,
	Status:              0,
}

const (
	RegistradorTemperatura         = 0
	RegistradorUmidade             = 1
	RegistradorSetpointTemperatura = 2
	RegistradorSetpointUmidade     = 3
	RegistradorAlarmes             = 4
	RegistradorStatus              = 5
)

const (
	QuantidadeRegistradores = 6
	FatorDivisao            = 1.0
)

var RegAddrs = []uint16{
	DixellRegisters.Temperatura,
	DixellRegisters.Umidade,
	DixellRegisters.SetpointTemperatura,
	DixellRegisters.SetpointUmidade,
	DixellRegisters.Alarmes,
	DixellRegisters.Status,
}

const (
	AlarmeAltaTemperatura  = 1 << 0
	AlarmeBaixaTemperatura = 1 << 1
	AlarmeAltaUmidade      = 1 << 2
	AlarmeFalhaComunicacao = 1 << 3
	AlarmeSensorDefeito    = 1 << 4
)

var AlarmeLabel = map[int]string{
	AlarmeAltaTemperatura:  "Alta Temperatura",
	AlarmeBaixaTemperatura: "Baixa Temperatura",
	AlarmeAltaUmidade:      "Alta Umidade",
	AlarmeFalhaComunicacao: "Falha de Comunicacao",
	AlarmeSensorDefeito:    "Sensor com Defeito",
}
