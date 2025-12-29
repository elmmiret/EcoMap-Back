# Checklist de Verificación del Sistema de Chat

## 🚀 Inicio Rápido

### 1. Iniciar el servidor
```bash
npm run dev
```

**Verificar en la consola:**
- ✅ "Socket.io initialized"
- ✅ "Message queue processor started"
- ✅ "Recovering X pending messages" (si hay mensajes pendientes)

---

## 📋 Tests Manuales Rápidos

### Test 1: Verificar que el servidor inicia correctamente
```bash
curl http://localhost:3000/
# Esperado: "API running."
```

### Test 2: Verificar migración de base de datos
```bash
cd /home/tacosrra/PES/PESkaos-back
npx prisma studio
# Abrir tabla 'message' y verificar:
# - Campo 'status' existe
# - Campo 'retry_count' existe
# - Campo 'last_error' existe
# - Campo 'updated_at' existe
```

### Test 3: Tests automatizados de schema
```bash
npm run test tests/chat-system.test.js
```

### Test 4: Tests de integración completos (requiere 2 usuarios)
```bash
./tests/test-chat-system.sh
# Sigue las instrucciones del script
```

---

## 🔍 Verificación Manual de Endpoints

### Prerrequisitos
Necesitas 2 tokens JWT de usuarios diferentes. Obtenerlos de:
- Firebase Auth → obtener ID token
- POST /api/users/sync con el token de Firebase

```bash
# Guardar tokens en variables
export TOKEN1="tu_token_jwt_usuario_1"
export TOKEN2="tu_token_jwt_usuario_2"
export USERNAME2="username_del_usuario_2"
```

### 1. Crear/Obtener Chat
```bash
curl -X POST http://localhost:3000/api/chats \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME2\"}"

# Guardar el chat_id de la respuesta
export CHAT_ID="chat-id-de-respuesta"
```

### 2. Enviar Mensaje Simple
```bash
curl -X POST http://localhost:3000/api/chats/$CHAT_ID/messages \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hola! Mensaje de prueba"}'

# Verificar respuesta:
# - success: true
# - message.status: "SENT" o "PENDING"
# - message.message_id existe

# Guardar message_id
export MESSAGE_ID="message-id-de-respuesta"
```

### 3. Consultar Estado del Mensaje
```bash
curl http://localhost:3000/api/chats/messages/$MESSAGE_ID/status \
  -H "Authorization: Bearer $TOKEN1"

# Verificar:
# - status.status: debe ser SENT, DELIVERED o READ
# - status.retry_count: número de reintentos
# - status.last_error: null si todo OK
```

### 4. Obtener Mensajes del Chat
```bash
curl http://localhost:3000/api/chats/$CHAT_ID/messages \
  -H "Authorization: Bearer $TOKEN1"

# Verificar que aparece el mensaje enviado
```

### 5. Listar Chats
```bash
curl http://localhost:3000/api/chats \
  -H "Authorization: Bearer $TOKEN1"

# Verificar:
# - Aparece el chat creado
# - unread_count correcto
# - last_message existe
```

### 6. Marcar como Leído
```bash
curl -X PUT http://localhost:3000/api/chats/$CHAT_ID/read \
  -H "Authorization: Bearer $TOKEN2"

# Verificar success: true
```

### 7. Enviar Mensaje con Media
```bash
curl -X POST http://localhost:3000/api/chats/$CHAT_ID/messages \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"content": "Foto adjunta", "media": ["https://example.com/image.jpg"]}'

# Debe aceptarse
```

### 8. Estadísticas de Cola
```bash
curl http://localhost:3000/api/chats/queue/stats \
  -H "Authorization: Bearer $TOKEN1"

# Verificar:
# - stats.queueSize: número de mensajes en cola
# - stats.messages: array de mensajes pendientes
```

---

## ✅ Validaciones a Probar

### 1. Mensaje muy largo (debe fallar)
```bash
curl -X POST http://localhost:3000/api/chats/$CHAT_ID/messages \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"content": "'$(printf 'A%.0s' {1..1001})'"}'

# Esperado: error: "MESSAGE_TOO_LONG"
```

### 2. URL no HTTPS (debe fallar)
```bash
curl -X POST http://localhost:3000/api/chats/$CHAT_ID/messages \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"content": "test", "media": ["http://example.com/image.jpg"]}'

# Esperado: error: "INSECURE_MEDIA_URL"
```

### 3. URL inválida (debe fallar)
```bash
curl -X POST http://localhost:3000/api/chats/$CHAT_ID/messages \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"content": "test", "media": ["no-es-url"]}'

# Esperado: error: "INVALID_MEDIA_URL_FORMAT"
```

### 4. Mensaje vacío (debe fallar)
```bash
curl -X POST http://localhost:3000/api/chats/$CHAT_ID/messages \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"content": ""}'

# Esperado: error: "INVALID_CONTENT_OR_MEDIA"
```

### 5. Demasiados archivos media (debe fallar)
```bash
curl -X POST http://localhost:3000/api/chats/$CHAT_ID/messages \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"content": "test", "media": ["https://example.com/1.jpg","https://example.com/2.jpg","https://example.com/3.jpg","https://example.com/4.jpg","https://example.com/5.jpg","https://example.com/6.jpg","https://example.com/7.jpg","https://example.com/8.jpg","https://example.com/9.jpg","https://example.com/10.jpg","https://example.com/11.jpg"]}'

# Esperado: error: "TOO_MANY_MEDIA"
```

---

## 🔧 Verificaciones de Sistema

### 1. Verificar que Prisma Client está actualizado
```bash
npx prisma generate
# No debe dar errores
```

### 2. Verificar logs del servidor
Al iniciar el servidor con `npm run dev`, debes ver:
```
✓ Servidor Express corriendo en http://localhost:3000
✓ Socket.io initialized
✓ Message queue processor started
✓ Recovering 0 pending messages (o más si hay mensajes pendientes)
```

### 3. Verificar que no hay errores de lint
```bash
npm run lint
# Solo warnings aceptables, sin errores
```

### 4. Verificar estructura de archivos
```bash
ls -la src/services/message-queue.service.js
ls -la src/services/message.service.js
ls -la src/api/middlewares/chat.middleware.js
ls -la docs/MESSAGE_QUEUE_SYSTEM.md
ls -la tests/test-chat-system.sh
ls -la tests/chat-system.test.js
# Todos deben existir
```

---

## 🌐 Pruebas de WebSocket (Opcional)

Para probar eventos de Socket.io necesitas un cliente. Ejemplo con Node.js:

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3000', {
  auth: {
    token: 'TU_TOKEN_JWT'
  }
});

socket.on('connect', () => {
  console.log('✓ Conectado a Socket.io');
});

socket.on('new_message', (data) => {
  console.log('📩 Nuevo mensaje:', data);
});

socket.on('message_status_updated', (data) => {
  console.log('📊 Estado actualizado:', data);
});

socket.on('messages_read', (data) => {
  console.log('✓ Mensajes leídos:', data);
});
```

---

## 📊 Resumen de Estados

| Estado | Descripción | Siguiente Estado Posible |
|--------|-------------|-------------------------|
| PENDING | Recién creado, esperando envío | SENT, FAILED |
| SENT | Enviado vía Socket/Push | DELIVERED |
| DELIVERED | Confirmado por receptor | READ |
| READ | Leído por usuario | - (final) |
| FAILED | Error tras 3 reintentos | - (final) |

---

## ✅ Checklist Final

- [ ] Servidor inicia sin errores
- [ ] Migración de BD aplicada correctamente
- [ ] Tests automatizados pasan
- [ ] Endpoint POST /api/chats funciona
- [ ] Endpoint POST /api/chats/:chatId/messages funciona
- [ ] Endpoint GET /api/chats/:chatId/messages funciona
- [ ] Endpoint GET /api/chats/messages/:messageId/status funciona
- [ ] Endpoint GET /api/chats/queue/stats funciona
- [ ] Endpoint PUT /api/chats/:chatId/read funciona
- [ ] Validación de longitud funciona
- [ ] Validación de URLs funciona
- [ ] Validación de HTTPS funciona
- [ ] Cola de mensajes se inicializa
- [ ] Mensajes pendientes se recuperan al iniciar
- [ ] Estados de mensaje funcionan correctamente
- [ ] Swagger actualizado con nuevos endpoints

---

## 🐛 Troubleshooting

### Error: "Prisma Client did not initialize"
```bash
npx prisma generate
npm run dev
```

### Error: "message_status does not exist"
```bash
npx prisma migrate deploy
# o
npx prisma migrate dev
```

### Error: "Cannot find module message-queue.service"
Verificar que el archivo existe y tiene la extensión `.js`

### Cola no procesa mensajes
Verificar en logs del servidor que aparece "Message queue processor started"

### WebSockets no funcionan
- Verificar que Socket.io está inicializado
- Verificar CORS en configuración de Socket.io
- Usar token válido en handshake de autenticación
