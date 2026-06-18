package models

type ConfiguracaoSistema struct {
	Chave string `gorm:"primaryKey;type:varchar(100)" json:"chave"`
	Valor string `gorm:"type:text" json:"valor"`
}

func (ConfiguracaoSistema) TableName() string {
	return "configuracoes"
}

type ConfiguracaoSistemaRequest struct {
	ModbusModo     string `json:"modbus_modo"`
	ModbusTCPHost  string `json:"modbus_tcp_host"`
	ModbusTCPPort  int    `json:"modbus_tcp_port"`
}
