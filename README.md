# Coldvisio

Sistema de monitoramento de temperatura e umidade para controladores Dixell XH260V via Modbus RTU/RS485.

---

## Requisitos

- **Docker Desktop** (para PostgreSQL)
- **Windows 10/11** ou **Linux**
- Conversor USB/RS485 (Silicon Labs CP210x ou similar)

---

## Instalacao e Execucao

### 1. Subir o banco de dados (Docker)

```powershell
docker compose up -d postgres
```

### 2. Iniciar o sistema

```powershell
.\backend\server.exe
```

### 3. Acessar

Abra o navegador em **http://localhost:8080**

Login padrao: **Admin** / **Admin**

---

## Expor na rede interna (servidor)

Para acessar o Coldvisio de outros computadores na mesma rede:

### 1. Descobrir o IP do servidor

```powershell
ipconfig
```

Anote o **Endereco IPv4** (ex: `192.168.1.50`, `10.0.0.15`)

### 2. Liberar a porta no Firewall do Windows

Execute como **Administrador** no PowerShell:

```powershell
# Liberar porta 8080 para conexoes de entrada
netsh advfirewall firewall add rule name="Coldvisio 8080" dir=in action=allow protocol=TCP localport=8080
```

Para remover a regra (se necessario):

```powershell
netsh advfirewall firewall delete rule name="Coldvisio 8080"
```

### 3. Acessar de outros PCs

Nos outros computadores da rede, abra o navegador:

```
http://IP_DO_SERVIDOR:8080
```

Exemplo: `http://192.168.1.50:8080`

---

## Cadastrar Maquinas

1. Va em **Configuracao** (precisa estar logado)
2. Clique em **Descobrir Controladores** para scanear a rede Modbus
3. Ou cadastre manualmente: **Nova Maquina** → Nome + Endereco Modbus (1-247)
4. Configure os **setpoints de alarme** clicando no icone de engrenagem

---

## Estrutura de Pastas

```
COLDFUTURE/
├── backend/
│   ├── server.exe          ← Executavel (API + Frontend)
│   ├── .env                ← Configuracao (COM, DB)
│   └── backups/            ← Backups diarios e CSV de limpeza
├── frontend/               ← Codigo fonte React
├── docker-compose.yml      ← PostgreSQL
├── Dockerfile              ← Build Linux (Docker completo)
└── build.bat               ← Script de build completo
```

---

## Build completo (desenvolvimento)

```powershell
.\build.bat
```

Isso compila o frontend, embute no backend e gera o `server.exe`.

---

## Docker Linux (tudo em container)

```bash
docker compose --profile linux up -d
```

Acesse: `http://localhost`

---

## Endpoints da API

| Metodo | Rota | Auth | Descricao |
|---|---|---|---|
| `POST` | `/api/login` | Nao | Login (Admin/Admin) |
| `GET` | `/api/maquinas` | Nao | Listar maquinas |
| `POST` | `/api/maquinas` | Sim | Criar maquina |
| `PUT` | `/api/maquinas/:id` | Sim | Atualizar maquina |
| `DELETE` | `/api/maquinas/:id` | Sim | Remover maquina |
| `PUT` | `/api/maquinas/:id/setpoints` | Sim | Salvar setpoints |
| `GET` | `/api/maquinas/descobrir` | Nao | Scan Modbus |
| `GET` | `/api/ultima/:id` | Nao | Ultima leitura (DB) |
| `GET` | `/api/cache` | Nao | Leituras em memoria |
| `GET` | `/api/periodo` | Nao | Historico (unica maquina) |
| `GET` | `/api/periodo-multiplas` | Nao | Historico (multiplas) |
| `GET` | `/api/periodo/export` | Nao | Exportar CSV |
| `GET` | `/api/resumo-diario` | Nao | Min/Max diario |
| `GET` | `/api/backup` | Nao | Backup JSON |
| `GET` | `/api/health` | Nao | Health check |

---

## Configuracao (.env)

```env
MODBUS_PORT=COM4          # Porta serial do conversor
MODBUS_BAUDRATE=9600      # Baud rate
MODBUS_PARITY=N           # N=None, E=Even, O=Odd
MODBUS_STOPBITS=1         # Stop bits
MODBUS_TIMEOUT=2          # Timeout (segundos)
DB_HOST=localhost         # Host do PostgreSQL
DB_PORT=5433              # Porta mapeada do Docker
DB_USER=dixell
DB_PASSWORD=dixell123
DB_NAME=dixell_monitor
SERVER_PORT=8080          # Porta do servidor web
READ_INTERVAL=300         # Intervalo de leitura (segundos)
```
