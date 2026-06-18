FROM golang:1.22-alpine AS go-builder
WORKDIR /build
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./

FROM node:20-alpine AS node-builder
WORKDIR /build
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM golang:1.22-alpine AS final-builder
WORKDIR /build
COPY --from=go-builder /build/ ./
COPY --from=node-builder /build/dist ./internal/web/dist/
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache tzdata curl
RUN cp /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime
RUN addgroup -S appuser && adduser -S appuser -G appuser -h /app && \
    chown -R appuser:appuser /app

COPY --from=final-builder /server /app/server

EXPOSE 8080
USER appuser
WORKDIR /app
CMD ["/app/server"]
