package handlers

import (
	"net/http"

	"dixell-monitor/internal/auth"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct{}

func NewAuthHandler() *AuthHandler {
	return &AuthHandler{}
}

type LoginRequest struct {
	Usuario string `json:"usuario"`
	Senha   string `json:"senha"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dados invalidos"})
		return
	}
	token := auth.Login(req.Usuario, req.Senha)
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "credenciais invalidas"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token})
}
