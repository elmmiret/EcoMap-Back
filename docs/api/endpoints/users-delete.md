# Endpoint: Eliminar Cuenta de Usuario

## `DELETE /api/users/me`

Este endpoint permite a un usuario autenticado eliminar permanentemente su propia cuenta. La operación es irreversible y elimina todos los datos del usuario tanto de la base de datos local como del sistema de autenticación de Firebase.

Por seguridad, este endpoint requiere que el usuario haya iniciado sesión recientemente (en los últimos 5 minutos). Si el token de autenticación es más antiguo, la solicitud será rechazada.

---

## Requisitos

### Cabeceras (Headers)

- `Authorization`: `Bearer <JWT>`
  - **Obligatorio**. El token JWT del usuario que desea eliminar su cuenta. El token debe ser válido y no haber expirado.

### Cuerpo (Body)

- No se requiere cuerpo para esta solicitud.

---

## Respuestas Posibles

### ✅ 200 OK: Cuenta Eliminada Correctamente

Indica que la cuenta del usuario ha sido eliminada con éxito de todos los sistemas.

```json
{
  "success": true,
  "message": "Tu cuenta ha sido eliminada permanentemente."
}
```

### ❌ 401 Unauthorized: Autenticación Reciente Requerida

Se devuelve si el token JWT del usuario fue emitido hace más de 5 minutos. Se le debe pedir al usuario que inicie sesión de nuevo antes de poder eliminar su cuenta.

```json
{
  "success": false,
  "message": "La sesión ha expirado. Por favor, inicie sesión de nuevo para continuar.",
  "code": "RECENT_LOGIN_REQUIRED"
}
```

### ❌ 401 Unauthorized: Token Inválido o Ausente

Se devuelve si el token JWT no se proporciona, es inválido o ha expirado.

```json
{
  "success": false,
  "message": "Token de autenticación no proporcionado o inválido.",
  "code": "AUTH_ERROR"
}
```

### ❌ 500 Internal Server Error: Error Genérico

Se devuelve si ocurre un error inesperado en el servidor durante el proceso de eliminación.

```json
{
  "success": false,
  "message": "Ocurrió un error al intentar eliminar tu cuenta."
}
```

### ❌ 500 Internal Server Error: Error de Firebase

Se devuelve si ocurre un problema específico al intentar eliminar al usuario del servicio de autenticación de Firebase.

```json
{
  "success": false,
  "message": "Ocurrió un error con el servicio de autenticación al intentar eliminar tu cuenta.",
  "code": "FIREBASE_ERROR"
}
```

---

## Flujo de Implementación en Frontend

1.  **Confirmación del Usuario**: Antes de llamar a este endpoint, muestra un diálogo de confirmación muy claro al usuario, advirtiéndole que la eliminación de la cuenta es **permanente e irreversible**.
2.  **Llamada a la API**: Si el usuario confirma, realiza una solicitud `DELETE` a `/api/users/me` con el token JWT del usuario en la cabecera `Authorization`.
3.  **Manejo de la Respuesta**:
    - Si la respuesta es `200 OK`, la cuenta ha sido eliminada. Debes limpiar cualquier dato de sesión local (JWT, datos de usuario, etc.) y redirigir al usuario a la pantalla de inicio de sesión o a una página de despedida.
    - Si la respuesta es `401 RECENT_LOGIN_REQUIRED`, informa al usuario que necesita volver a iniciar sesión por seguridad. Una vez que inicie sesión de nuevo, obtendrás un nuevo JWT con el que podrás reintentar la eliminación.
    - Si la respuesta es otro error (401, 500, etc.), muestra un mensaje de error genérico al usuario indicando que no se pudo completar la solicitud.
