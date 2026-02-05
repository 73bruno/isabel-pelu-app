# Infraestructura VPS y WAHA (WhatsApp API)

Este documento detalla la configuración del servidor VPS dedicado a gestionar la API de WhatsApp (WAHA) para Isabel PeluApp.

## 1. Acceso al Servidor

*   **Proveedor:** Hetzner Cloud (Falkenstein, DE)
*   **IP Pública:** `46.225.95.59`
*   **SO:** Ubuntu 24.04 LTS
*   **Usuario:** `root`
*   **Acceso SSH:** `ssh root@46.225.95.59`

## 2. Pila Tecnológica (Docker)

Todo el servicio corre dentro de Docker para facilitar la portabilidad y persistencia.

*   **Directorio Base:** `/opt/waha`
*   **Imagen:** `devlikeapro/waha:latest` (Core Version - WEBJS)
*   **Docker Compose:** `/opt/waha/docker-compose.yml`

### Comandos Útiles

```bash
# Ver estado
docker ps
docker logs waha --tail 50 -f

# Reiniciar WAHA
cd /opt/waha
docker compose down && docker compose up -d

# Ver logs de auto-arranque
tail -f /var/log/waha-keepalive.log
```

## 3. Configuración WAHA

El servicio expone la API en el puerto **3001** (mapeado internamente al 3000).

*   **Dashboard URL:** `http://46.225.95.59:3001/dashboard`
*   **API URL Local:** `http://localhost:3000` (desde dentro del servidor)

### Credenciales Configuradas
Definidas en `docker-compose.yml`:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `WAHA_API_KEY` | `secretkey123` | Clave para autenticar peticiones API |
| `WAHA_DASHBOARD_USERNAME` | `admin` | Usuario acceso web |
| `WAHA_DASHBOARD_PASSWORD` | `secret` | Password acceso web |

### Persistencia de Datos
Se utilizan volúmenes Docker (`volumes` en compose) mapeados al host para asegurar que la sesión de WhatsApp no se pierda al reiniciar:

*   `/opt/waha/sessions` -> `/app/.sessions` (Credenciales de WhatsApp)
*   `/opt/waha/media` -> `/app/media` (Archivos adjuntos)

## 4. Sistema de Alta Disponibilidad (Auto-Start)

Para evitar que la sesión de WhatsApp se quede en estado `STOPPED` tras un reinicio del servidor, se ha implementado un script de vigilancia ("watchdog").

*   **Script:** `/opt/waha/ensure-session.sh`
*   **Frecuencia:** Ejecuta cada minuto (Cron).
*   **Lógica:**
    1.  Consulta el estado de la sesión `default`.
    2.  Si está `STOPPED`, envía una petición `POST /api/sessions/start`.
    3.  Si no existe, intenta crearla.

### Código del Script
```bash
#!/bin/bash
KEY="secretkey123"
URL="http://localhost:3000"
STATUS=$(curl -s -H "X-Api-Key: $KEY" "$URL/api/sessions/default" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$STATUS" == "STOPPED" ]; then
    echo "$(date): Session STOPPED. Starting..."
    curl -s -X POST -H "X-Api-Key: $KEY" -H "Content-Type: application/json" -d '{"name":"default"}' "$URL/api/sessions/start"
fi
```

## 5. Integración con la App (Next.js)

La aplicación Next.js se comunica con esta VPS mediante:

*   **Librería:** `lib/whatsapp.ts` (Implementa lógica anti-bloqueo, typing, delays).
*   **Variables de Entorno (.env.local):**
    ```env
    WAHA_URL=http://46.225.95.59:3001
    WAHA_API_KEY=secretkey123
    WAHA_SESSION=default
    ```

## 6. Seguridad y Buenas Prácticas

1.  **Firewall (UFW):** Solo permite tráfico por puertos 22 (SSH) y 3001 (WAHA).
2.  **Anti-Bloqueo:** La app implementa delays aleatorios y "typing simulation" antes de enviar mensajes para parecer humana.
3.  **Mode Debug:** En desarrollo, solo envía mensajes a números en la `WHATSAPP_WHITELIST`.

---
*Documento generado el 05/02/2026*
