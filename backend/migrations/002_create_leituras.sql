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
);

CREATE INDEX IF NOT EXISTS idx_leituras_maquina_data ON leituras (maquina_id, data_hora DESC);
