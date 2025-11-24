# 📱 Flujo de Implementación de Chat (Frontend)

Este documento detalla el protocolo y flujo de trabajo que debe seguir la aplicación cliente (Frontend) para integrar el sistema de chat en tiempo real.

## 1. Conexión y Autenticación

### Socket.io
El cliente debe establecer una conexión persistente con el servidor de sockets.

*   **URL**: `https://tu-api.com` (o `http://localhost:3000` en dev)
*   **Auth**: Debe enviar el JWT en el handshake.

```javascript
// Ejemplo Cliente (JS)
const socket = io('https://tu-api.com', {
  auth: {
    token: 'eyJhbGciOiJIUz...' // Tu JWT de backend
  }
});
```

### Eventos de Conexión
*   `connect`: Conexión exitosa.
*   `connect_error`: Error de autenticación o red.

---

## 2. Flujo de Mensajería

### A. Enviar Mensaje (Usuario A)
1.  El usuario escribe y pulsa "Enviar".
2.  **Frontend**: Muestra el mensaje en la UI con estado "Enviando..." (reloj).
3.  **API Call**: Hace `POST /api/chats/:chatId/messages` con el contenido.
4.  **Respuesta**:
    *   ✅ **201 Created**: El servidor guardó el mensaje. Frontend cambia estado a "Enviado" (check simple `✓`).
    *   ❌ **Error/Timeout**: Frontend marca como "Fallido" y ofrece botón de "Reintentar".

### B. Recibir Mensaje (Usuario B)
1.  **Evento Socket**: El cliente escucha el evento `new_message`.
2.  **Payload**:
    ```json
    {
      "chat_id": "uuid-chat",
      "message": {
        "message_id": "uuid-msg",
        "content": "Hola",
        "sender_id": "uuid-user-a",
        "created_at": "..."
      }
    }
    ```
3.  **Acción Frontend**:
    *   Pinta el mensaje en el chat si está abierto.
    *   Muestra notificación/badge si está en otra pantalla.
    *   **IMPORTANTE**: Emite evento `message_received` para confirmar entrega.
        ```javascript
        socket.emit('message_received', { message_id: 'uuid-msg' });
        ```

---

## 3. Estados del Mensaje (UI)

| Estado Visual | Significado Técnico | Trigger |
| :--- | :--- | :--- |
| 🕒 **Enviando** | Petición HTTP en vuelo | Click "Enviar" |
| ✓ **Enviado** | Guardado en Servidor | Respuesta `201 OK` del POST |
| ✓✓ **Entregado** | Recibido por el destinatario | (Opcional) Implementar evento `message_delivered` si se desea feedback real-time |
| 🔵 **Leído** | Leído por el destinatario | Evento socket `messages_read` |

---

## 4. Sincronización y Reconexión

### Al abrir la App o recuperar conexión:
1.  **Reconectar Socket**: El cliente de socket.io lo hace automático, pero verifica el estado.
2.  **Sincronizar Chats**:
    *   Llamar a `GET /api/chats`.
    *   Actualizar lista de conversaciones y contadores de `unread_count`.
3.  **Sincronizar Mensajes (Chat abierto)**:
    *   Llamar a `GET /api/chats/:chatId/messages`.
    *   El backend automáticamente marcará como `delivered: true` todo lo que te descargues.

---

## 5. Gestión de Lectura

Cuando el usuario **entra** en un chat o hace scroll hasta abajo:

1.  **API Call**: Llamar a `PUT /api/chats/:chatId/read`.
2.  **Efecto**:
    *   Backend marca mensajes como leídos.
    *   Backend emite evento `messages_read` al OTRO usuario.
    *   El OTRO usuario recibe el evento y actualiza sus doble checks a azul (🔵).
