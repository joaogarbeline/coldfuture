package auth

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const secret = "coldvisio-secret"

func Login(usuario, senha string) string {
	if strings.ToLower(usuario) != "admin" || strings.ToLower(senha) != "admin" {
		return ""
	}
	expiry := time.Now().Add(24 * time.Hour).Unix()
	data := fmt.Sprintf("%s:%d", usuario, expiry)
	hash := sha256.Sum256([]byte(data + ":" + secret))
	token := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%d:%x", usuario, expiry, hash)))
	return token
}

func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "nao autorizado"})
			c.Abort()
			return
		}
		token := strings.TrimPrefix(authHeader, "Bearer ")
		decoded, err := base64.StdEncoding.DecodeString(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "nao autorizado"})
			c.Abort()
			return
		}
		parts := strings.SplitN(string(decoded), ":", 3)
		if len(parts) != 3 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "nao autorizado"})
			c.Abort()
			return
		}
		username := parts[0]
		expiryStr := parts[1]
		sig := parts[2]

		expiry, err := strconv.ParseInt(expiryStr, 10, 64)
		if err != nil || time.Now().Unix() > expiry {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "nao autorizado"})
			c.Abort()
			return
		}

		data := fmt.Sprintf("%s:%s", username, expiryStr)
		expectedHash := sha256.Sum256([]byte(data + ":" + secret))
		expectedSig := fmt.Sprintf("%x", expectedHash)

		if sig != expectedSig {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "nao autorizado"})
			c.Abort()
			return
		}

		c.Next()
	}
}
