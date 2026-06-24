package modbus

var DixellRegisters = struct {
	Temperatura         uint16
	Umidade             uint16
	SetpointTemperatura uint16
	SetpointUmidade     uint16
	Comando             uint16
	StatusOnOff         uint16
	StatusReles         uint16
	Alarmes             uint16
}{
	Temperatura:         256,
	Umidade:             260,
	SetpointTemperatura: 839,
	SetpointUmidade:     840,
	Comando:             1280,
	StatusOnOff:         32889,
	StatusReles:         32891,
	Alarmes:             32895,
}

const (
	CmdDesligar uint16 = 1
	CmdLigar    uint16 = 257
	CmdDegelo   uint16 = 514
)

const (
	StatusDegeloBit uint16 = 512
)

const (
	BitRefrigeracao   = 1
	BitVentilacao     = 4
	BitDesumidificacao = 64
	BitDegelo         = 512
)

const FatorDivisao = 1.0

const (
	AlarmeAltaTemperatura   = 1 << 0
	AlarmeBaixaTemperatura  = 1 << 1
	AlarmeAltaUmidade       = 1 << 2
	AlarmeBaixaUmidade      = 1 << 3
	AlarmeFalhaSensor1      = 1 << 4
	AlarmeFalhaSensor2      = 1 << 5
	AlarmeFalhaSensor3      = 1 << 6
	AlarmeFalhaSensor4      = 1 << 7
	AlarmeExterno           = 1 << 8
	AlarmeCompressor        = 1 << 9
	AlarmeTimeoutDegelo     = 1 << 10
	AlarmeErroEEPROM        = 1 << 11
	AlarmeFalhaRTC          = 1 << 12
	AlarmeFalhaRS485        = 1 << 13
	AlarmePortaAberta       = 1 << 14
	AlarmeTempMinima        = 1 << 15
)

var AlarmeLabel = map[int]string{
	AlarmeAltaTemperatura:  "Alta Temperatura",
	AlarmeBaixaTemperatura: "Baixa Temperatura",
	AlarmeAltaUmidade:      "Alta Umidade",
	AlarmeBaixaUmidade:     "Baixa Umidade",
	AlarmeFalhaSensor1:     "Falha Sensor 1 (Temperatura)",
	AlarmeFalhaSensor2:     "Falha Sensor 2 (Umidade)",
	AlarmeFalhaSensor3:     "Falha Sensor 3",
	AlarmeFalhaSensor4:     "Falha Sensor 4",
	AlarmeExterno:          "Alarme Externo",
	AlarmeCompressor:       "Protecao Termica Compressor",
	AlarmeTimeoutDegelo:    "Timeout do Degelo",
	AlarmeErroEEPROM:       "Erro de EEPROM/Memoria",
	AlarmeFalhaRTC:         "Falha no Relogio RTC",
	AlarmeFalhaRS485:       "Falha de Comunicacao RS485",
	AlarmePortaAberta:      "Porta Aberta",
	AlarmeTempMinima:       "Temperatura Minima Atingida",
}
