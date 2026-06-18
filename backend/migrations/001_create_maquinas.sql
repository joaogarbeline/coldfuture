CREATE TABLE IF NOT EXISTS maquinas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100),
    endereco_modbus INTEGER UNIQUE,
    ativo BOOLEAN DEFAULT TRUE
);
