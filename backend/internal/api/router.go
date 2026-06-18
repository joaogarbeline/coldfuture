package api

import (
	"io/fs"
	"net/http"
	"strings"

	"dixell-monitor/internal/auth"
	"dixell-monitor/internal/handlers"
	"dixell-monitor/internal/web"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(
	maquinaHandler *handlers.MaquinaHandler,
	leituraHandler *handlers.LeituraHandler,
	authHandler *handlers.AuthHandler,
	backupHandler *handlers.BackupHandler,
) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)

	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	router.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	api := router.Group("/api")
	{
		api.POST("/login", authHandler.Login)

		api.GET("/maquinas", maquinaHandler.Listar)
		api.GET("/maquinas/descobrir", maquinaHandler.Descobrir)
		api.POST("/maquinas", auth.AuthRequired(), maquinaHandler.Criar)
		api.PUT("/maquinas/:id", auth.AuthRequired(), maquinaHandler.Atualizar)
		api.PUT("/maquinas/:id/setpoints", auth.AuthRequired(), maquinaHandler.AtualizarSetpoints)
		api.DELETE("/maquinas/:id", auth.AuthRequired(), maquinaHandler.Remover)

		leituras := api.Group("/leituras")
		{
			leituras.GET("", leituraHandler.Listar)
			leituras.GET("/:maquinaId", leituraHandler.ListarPorMaquina)
		}

		api.GET("/ultima/:maquinaId", leituraHandler.BuscarUltima)
		api.GET("/cache", leituraHandler.BuscarCache)
		api.GET("/periodo", leituraHandler.BuscarPorPeriodo)
		api.GET("/periodo/export", leituraHandler.ExportarCSV)
		api.GET("/periodo-multiplas", leituraHandler.BuscarPorPeriodoMultiplas)
		api.GET("/estatisticas/:maquinaId", leituraHandler.BuscarEstatisticas)
		api.GET("/estatisticas-diarias/:maquinaId", leituraHandler.BuscarEstatisticasDiarias)
		api.GET("/resumo-diario", leituraHandler.BuscarResumoDiarioPeriodo)

		api.GET("/backup", backupHandler.ExportarBackup)

		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok"})
		})
	}

	staticFS, _ := fs.Sub(web.Dist, "dist")
	router.Use(spaMiddleware(staticFS))

	return router
}

func spaMiddleware(staticFS fs.FS) gin.HandlerFunc {
	fileServer := http.FileServer(http.FS(staticFS))

	return func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.Next()
			return
		}

		path := strings.TrimPrefix(c.Request.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		f, err := staticFS.Open(path)
		if err == nil {
			f.Close()
			fileServer.ServeHTTP(c.Writer, c.Request)
			c.Abort()
			return
		}

		c.Request.URL.Path = "/index.html"
		fileServer.ServeHTTP(c.Writer, c.Request)
		c.Abort()
	}
}
