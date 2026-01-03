# Sistema de Cola de Mensajes y Estados

## Descripción General

Sistema completo de gestión de mensajes con estados, retry automático, timeouts y cola de reintentos para garantizar la entrega confiable de mensajes en el chat.

## Estados de Mensaje

Los mensajes ahora tienen un campo `status` con los siguientes valores:

| Estado | Descripción | Uso |
|--------|-------------|-----|
| `PENDING` | Mensaje creado pero aún no enviado | Estado inicial al crear mensaje |
| `SENT` | Mensaje enviado exitosamente vía Socket/Push | Enviado a través de Socket.io o notificación push |
| `DELIVERED` | Mensaje entregado al destinatario | Confirmación de recepción del cliente |
| `READ` | Mensaje leído por el destinatario | Usuario abrió y leyó el mensaje |
| `FAILED` | Error en envío después de reintentos | Máximo de reintentos excedido |

## Flujo de Envío de Mensajes

### 1. Creación del Mensaje
```javascript
// POST /api/chats/:chatId/messages
{
  "content": "Hola!",
  "media": ["https://example.com/image.jpg"]
}
```

1. Se crea el mensaje en la BD con estado `PENDING`
2. Se intenta enviar con timeout de 30 segundos
3. Si tiene éxito → `SENT`
4. Si falla → `FAILED` y se añade a la cola de reintentos

### 2. Sistema de Reintentos

**Configuración:**
- Máximo de reintentos: 3
- Delay inicial: 2 segundos
- Backoff exponencial: delay × 2^retry_count
- Intervalo de procesamiento de cola: 5 segundos

**Proceso:**
1. Mensaje falla → se marca como `FAILED`
2. Se añade a la cola en memoria con `retry_count: 0`
3. Cola se procesa cada 5 segundos
4. Reintenta envío con delay exponencial
5. Si tiene éxito → `SENT` y se elimina de la cola
6. Si falla 3 veces → permanece en `FAILED`

### 3. Recuperación al Iniciar

Al iniciar el servidor:
- Se recuperan mensajes con estado `PENDING` o `FAILED`
- Con `retry_count < 3`
- Se añaden automáticamente a la cola de reintentos

## Endpoints

### Enviar Mensaje
```http
POST /api/chats/:chatId/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Texto del mensaje",
  "media": ["url1", "url2"]  // Opcional
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": {
    "message_id": "uuid",
    "status": "SENT",
    "content": "Texto del mensaje",
    "media": ["url1"],
    "retry_count": 0,
    "last_error": null,
    "created_at": "2024-12-29T10:00:00Z"
  }
}
```

### Consultar Estado de Mensaje
```http
GET /api/chats/messages/:messageId/status
Authorization: Bearer <token>
```

**Respuesta:**
```json
{
  "success": true,
  "status": {
    "message_id": "uuid",
    "status": "SENT",
    "is_read": false,
    "delivered": true,
    "retry_count": 1,
    "last_error": null,
    "created_at": "2024-12-29T10:00:00Z",
    "updated_at": "2024-12-29T10:00:05Z"
  }
}
```

### Estadísticas de Cola (Debug)
```http
GET /api/chats/queue/stats
Authorization: Bearer <token>
```

**Respuesta:**
```json
{
  "success": true,
  "stats": {
    "queueSize": 2,
    "messages": [
      {
        "messageId": "uuid1",
        "chatId": "chat-uuid",
        "retryCount": 1,
        "addedAt": 1640780400000,
        "nextRetryAt": 1640780404000
      }
    ]
  }
}
```

## Eventos de Socket

### Cliente → Servidor

**`message_received`** - Confirmar recepción de mensaje
```javascript
socket.emit('message_received', {
  message_id: 'uuid'
});
```

### Servidor → Cliente

**`new_message`** - Nuevo mensaje recibido
```javascript
socket.on('new_message', (data) => {
  // data: { chat_id, message }
});
```

**`message_status_updated`** - Cambio de estado
```javascript
socket.on('message_status_updated', (data) => {
  // data: { message_id, status, error? }
});
```

**`messages_read`** - Mensajes marcados como leídos
```javascript
socket.on('messages_read', (data) => {
  // data: { chat_id, read_by }
});
```

**`message_delivered`** - Mensaje entregado
```javascript
socket.on('message_delivered', (data) => {
  // data: { chat_id, message_id, delivered: true }
});
```

## Validaciones de Media

El middleware valida:
- ✅ Tipo: debe ser array
- ✅ Máximo 10 archivos
- ✅ URLs válidas y bien formadas
- ✅ Máximo 2048 caracteres por URL
- ✅ Solo HTTPS permitido
- ✅ No URLs vacías

## Modelo de Base de Datos

```prisma
model message {
  message_id    String          @id @default(uuid())
  chat_id       String
  sender_id     String
  content       String
  status        message_status  @default(PENDING)
  is_read       Boolean         @default(false)
  delivered     Boolean         @default(false)
  is_deleted    Boolean         @default(false)
  retry_count   Int             @default(0)
  last_error    String?
  created_at    DateTime        @default(now())
  updated_at    DateTime        @updatedAt
  
  @@index([status])
}

enum message_status {
  PENDING
  SENT
  DELIVERED
  READ
  FAILED
}
```

## Manejo de Errores

### Errores Comunes

| Error | Código HTTP | Descripción |
|-------|-------------|-------------|
| `MESSAGE_SEND_TIMEOUT` | 500 | Timeout de 30s excedido |
| `CHAT_NOT_FOUND` | 404 | Chat no existe |
| `USER_NOT_IN_CHAT` | 403 | Usuario no participa en el chat |
| `INVALID_CONTENT_OR_MEDIA` | 400 | Ni content ni media proporcionados |
| `MESSAGE_TOO_LONG` | 400 | Contenido excede 1000 caracteres |
| `TOO_MANY_MEDIA` | 400 | Más de 10 archivos multimedia |
| `INVALID_MEDIA_URL_FORMAT` | 400 | URL de media inválida |
| `INSECURE_MEDIA_URL` | 400 | URL no usa HTTPS |

### Estados de Error

Cuando un mensaje falla:
1. `status` → `FAILED`
2. `last_error` contiene el mensaje de error
3. `retry_count` incrementa
4. Se emite evento `message_status_updated` al remitente

## Configuración

Variables en el código (ajustables según necesidad):

```javascript
// message-queue.service.js
const MAX_RETRY_ATTEMPTS = 3;          // Máximo de reintentos
const RETRY_DELAY_MS = 2000;           // Delay inicial (2s)
const QUEUE_CHECK_INTERVAL_MS = 5000;  // Intervalo de cola (5s)

// chat.service.js
const MESSAGE_SEND_TIMEOUT_MS = 30000; // Timeout de envío (30s)

// chat.middleware.js
const MAX_CONTENT_LENGTH = 1000;       // Max longitud texto
const MAX_MEDIA_COUNT = 10;            // Max archivos multimedia
const MAX_URL_LENGTH = 2048;           // Max longitud URL
```

## Integración Frontend

### Enviar Mensaje
```javascript
const response = await fetch('/api/chats/${chatId}/messages', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    content: 'Hola!',
    media: ['https://example.com/image.jpg']
  })
});

const { message } = await response.json();
// Verificar message.status para saber si fue enviado
```

### Escuchar Cambios de Estado
```javascript
socket.on('message_status_updated', ({ message_id, status, error }) => {
  if (status === 'FAILED') {
    // Mostrar al usuario que el mensaje falló
    showError(`Mensaje falló: ${error}`);
  } else if (status === 'SENT') {
    // Actualizar UI - mensaje enviado
    updateMessageUI(message_id, 'sent');
  }
});
```

### Consultar Estado Específico
```javascript
const response = await fetch(`/api/chats/messages/${messageId}/status`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { status } = await response.json();
console.log('Estado actual:', status.status);
console.log('Reintentos:', status.retry_count);
```

## Notas de Implementación

1. **Cola en Memoria**: La cola se mantiene en memoria. En caso de reinicio del servidor, se recuperan mensajes pendientes de la BD.

2. **Timeout**: Si el envío tarda más de 30 segundos, se considera fallido y se reintenta.

3. **Backoff Exponencial**: Los reintentos usan delay exponencial (2s, 4s, 8s) para evitar sobrecarga.

4. **Socket vs Push**: Si el usuario está conectado vía Socket, se envía por ahí. Si está offline, se envía notificación push.

5. **Transiciones de Estado**: Los estados siguen un flujo lógico:
   - `PENDING` → `SENT` → `DELIVERED` → `READ`
   - `PENDING` → `FAILED` (si fallan todos los reintentos)

6. **Compatibilidad**: Los campos `delivered` e `is_read` se mantienen por compatibilidad y se sincronizan automáticamente con `status`.
