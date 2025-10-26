# Flujo: Eliminación de cuenta (DELETE /api/users/me)

Este documento define el flujo funcional completo para eliminar la cuenta del usuario autenticado. No contiene detalles de implementación, solo pasos, responsabilidades y consideraciones.

---

## Objetivo

Permitir que un usuario autenticado elimine definitivamente su cuenta y todos sus datos asociados en el sistema. La operación debe ser segura, idempotente y con experiencia de usuario clara.

---

## Alcance

- Solicitud de borrado del propio usuario (no se permite borrar a terceros).
- Eliminación de todos los datos asociados al usuario en la base de datos.
- Invalidación de sesiones/JWT del backend.
- Eliminación del usuario en Firebase (Identity).

---

## Requisitos previos

- El usuario debe estar autenticado con un token de Firebase válido.
- El backend debe poder identificar unívocamente al usuario por su `uid` (extraído del token).

---

## Contrato funcional (sin código)

- Método: DELETE
- Ruta: /api/users/me
- Autenticación: obligatoria (Firebase ID Token en el encabezado Authorization: Bearer …)
- Cuerpo: vacío
- Respuestas esperadas:
  - 200: Eliminación completada (o ya no existían datos; idempotente).
  - 401: Token ausente o inválido.
  - 500: Error interno no recuperable.

---

## Responsabilidades del Front

1. Confirmación explícita

- Mostrar un diálogo de confirmación explicando consecuencias: pérdida permanente de datos (puntos, mensajes, notificaciones, etc.).

2. Reautenticación

- Forzar reautenticación reciente (UX) antes de confirmar el borrado, para proteger contra sesiones antiguas.

3. Llamada HTTP

- Enviar DELETE a /api/users/me con el token de Firebase vigente en Authorization.
- No enviar body.

4. Post-acción en cliente

- Tras 200 OK:
  - Eliminar cualquier JWT del backend almacenado localmente.
  - Cerrar la sesión de Firebase en el cliente.
  - Redirigir a pantalla pública (por ejemplo, landing) y mostrar mensaje de confirmación.
- Ante 401/5xx: notificar al usuario y ofrecer reintentos o soporte.

---

## Responsabilidades del Back

1. Autenticación y autorización

- Validar el token de Firebase (y, si aplica, la frescura de la autenticación si se exige).
- Determinar el `uid` del usuario llamante. No se aceptan parámetros para borrar a otros usuarios.

2. Idempotencia y existencia

- Consultar si el usuario existe en BD.
- Si no existe: devolver 200 (idempotente) y registrar el hecho; intentar igualmente la eliminación en Firebase para coherencia.

3. Eliminación transaccional en BD

- Ejecutar una transacción que elimine la fila principal del usuario (p. ej., tabla `user` por `user_id = uid`).
- Delegar en las reglas de integridad referencial para eliminar en cascada el resto de entidades asociadas (ver sección “Datos afectados”).
- Confirmar la transacción y registrar auditoría mínima (uid, timestamp, resultado).

4. Invalidación de sesiones/JWT

- La eliminación de registros de sesión en BD debe ocurrir como parte de la cascada. No obstante, si existiera caché adicional, invalidarla.

5. Eliminación en Firebase

- Solicitar la eliminación del usuario en Firebase Identity por `uid`.
- Si el usuario no existe ya en Firebase, tratar como éxito (idempotente) y registrar.

6. Respuesta

- Devolver 200 con un mensaje claro de confirmación.
- En caso de error interno no recuperable (p. ej., fallo de la transacción), devolver 500.

---

## Datos afectados (referencial)

- Entidad principal: usuario (tabla raíz, identificada por `user_id = uid`).
- Entidades vinculadas típicas que deben desaparecer por cascada:
  - Perfil registrado del usuario (registered_user) y sus roles (admin, client, institution).
  - Sesiones activas (session).
  - Notificaciones (notification).
  - Mensajes enviados y recibidos (message) y sus adjuntos (message_media) vía relación con el perfil `client`.
  - Cualquier otro recurso dependiente directo o indirecto (según el modelo relacional vigente).

Nota: La implementación concreta de las cascadas depende del esquema actual de BD. Este flujo asume que las relaciones están definidas con borrado en cascada para evitar huérfanos.

---

## Reglas de seguridad y cumplimiento

- Garantizar que solo el propietario del token pueda invocar esta operación sobre su propia cuenta.
- Opcional: exigir autenticación reciente (p. ej., reautenticación en los últimos X minutos), verificando el `auth_time` del token.
- Registrar auditoría mínima (quién, cuándo, resultado). Evitar registrar datos sensibles.

---

## Consideraciones de UX

- Comunicar al usuario que la operación es irreversible.
- Ofrecer alternativa de desactivar/anonimizar si el negocio lo requiere (fuera de alcance de este flujo).

---

## Escenarios de prueba (sin código)

- Éxito con usuario existente: devuelve 200 y desaparecen todos los datos asociados.
- Idempotencia: dos solicitudes consecutivas devuelven 200; la segunda no encuentra datos pero no falla.
- Token inválido/ausente: devuelve 401.
- Fallo transaccional en BD: devuelve 500 y no deja datos a medias (rollback garantizado).
- Usuario inexistente en Firebase: el flujo sigue devolviendo 200 (idempotente).

---

## Métricas y observabilidad

- Contabilizar el número de eliminaciones, tiempos de ejecución, y principales errores.
- Logs suficientes para diagnóstico (sin exponer PII), con correlación por `uid` y request-id.

---

## Resumen

El borrado de cuenta es una operación sensible que debe ser atómica en BD, segura y claramente comunicada al usuario. El front confirma y autentica; el back valida, elimina en cascada, invalida sesiones y borra en Firebase, respondiendo de forma idempotente con un 200 en éxito o no-existencia.
