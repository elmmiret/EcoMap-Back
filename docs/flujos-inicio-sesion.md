# Flujo de Autenticación y Gestión de Sesión

Este documento describe el flujo conceptual para la autenticación de usuarios y la gestión de sesiones, combinando Firebase para la identidad y un sistema de JWT propio para la autorización en el backend.

## Componentes Principales

1.  **Token de Firebase (ID Token)**:
    - **Propósito**: Probar la identidad de un usuario. Es la "credencial" que demuestra que el usuario es quien dice ser según Firebase.
    - **Ciclo de vida**: Corto (generalmente 1 hora).
    - **Uso**: Se utiliza exclusivamente para comunicarse con el endpoint `/api/users/sync` del backend.

2.  **Token de Backend (JWT)**:
    - **Propósito**: Autorizar al usuario dentro de nuestra API para acceder a rutas protegidas. Contiene información del usuario en nuestra base de datos (rol, puntos, etc.).
    - **Ciclo de vida**: Corto (configurable, ej: 1-2 horas).
    - **Uso**: Se envía en el header `Authorization` de todas las peticiones a endpoints protegidos de nuestra API (excepto `/api/users/sync`).

3.  **Endpoint de Sincronización (`POST /api/users/sync`)**:
    - **Función**: Es la "puerta de entrada" al sistema. Su única misión es intercambiar un **Token de Firebase** válido por un **Token de Backend (JWT)**.
    - **Lógica**: Valida el token de Firebase. Si el usuario no existe en nuestra base de datos, lo crea. Si ya existe, simplemente genera una nueva sesión y un nuevo JWT.

4.  **Endpoint de Verificación de Sesión (`GET /api/users/me`)**:
    - **Función**: Permite al frontend comprobar rápidamente si un **Token de Backend (JWT)** que tiene guardado sigue siendo válido.
    - **Lógica**: Valida el JWT del backend. Si es válido, devuelve los datos del usuario. Si ha expirado o es inválido, devuelve un error `401 Unauthorized`.

## Flujos de Sesión

### 1. Flujo de Login Inicial (Primer inicio o después de un logout)

Este es el proceso cuando el usuario no tiene una sesión activa en el frontend.

1.  **Autenticación en Frontend**: El usuario inicia sesión a través de la UI con un proveedor de Firebase (Google, email/contraseña, etc.).
2.  **Obtención de Credencial**: El frontend recibe de Firebase un **ID Token**.
3.  **Sincronización con Backend**: El frontend envía este **ID Token** a nuestro endpoint `POST /api/users/sync`.
4.  **Generación de Sesión**: El backend valida el ID Token, crea o encuentra al usuario en la base de datos, genera un **JWT de Backend** y lo devuelve junto a su fecha de expiración.
5.  **Almacenamiento Local**: El frontend almacena de forma segura este **JWT de Backend** para futuras peticiones.

### 2. Flujo de "Remember Me" (Arranque de la App con Sesión Existente)

Este proceso se ejecuta cada vez que el usuario abre la aplicación para verificar si su sesión anterior sigue siendo válida.

1.  **Verificación Local**: El frontend comprueba si tiene un **JWT de Backend** guardado.
2.  **Chequeo con Backend**: Si existe, llama al endpoint de verificación (`GET /api/users/me`) enviando el JWT guardado.
3.  **Validación de Sesión**:
    - **Si el backend responde OK (200)**: El token es válido. El frontend extrae los datos del usuario de la respuesta y lo considera autenticado. La sesión continúa.
    - **Si el backend responde Error (401)**: El token ha expirado o es inválido. El frontend debe proceder al **Flujo de Renovación de Sesión**.

### 3. Flujo de Renovación de Sesión (Automático y Transparente)

Este flujo ocurre cuando el JWT del backend ha caducado, pero el usuario sigue teniendo una sesión válida en Firebase. Es la clave para una buena experiencia de usuario.

1.  **Detección de Expiración**: El frontend detecta que el JWT del backend ha expirado (ya sea comprobando su fecha de `exp` o por una respuesta `401` del backend).
2.  **Renovación con Firebase**: El frontend solicita a Firebase un **nuevo ID Token**. Firebase se lo dará sin pedir de nuevo las credenciales al usuario, ya que su sesión principal (de Firebase) sigue activa.
3.  **Sincronización con Backend**: El frontend vuelve a llamar a `POST /api/users/sync` con este **nuevo ID Token**.
4.  **Obtención de Nuevo JWT**: El backend devuelve un **nuevo JWT de Backend** con una nueva fecha de expiración.
5.  **Actualización Local**: El frontend reemplaza el JWT antiguo por el nuevo y la sesión continúa sin interrupciones para el usuario.

### 4. Flujo de Logout

1.  **Petición de Logout**: El frontend envía el **JWT de Backend** actual al endpoint `POST /api/users/logout`.
2.  **Invalidación en Backend**: El backend elimina el registro de la sesión de la base de datos, invalidando ese JWT de forma permanente.
3.  **Limpieza en Frontend**: El frontend elimina el JWT de su almacenamiento local.
4.  **Cierre de Sesión en Firebase**: El frontend llama a la función de `signOut()` de Firebase para cerrar también la sesión principal.

Este enfoque de doble token proporciona un balance entre seguridad (tokens de vida corta) y una buena experiencia de usuario (renovación transparente de sesiones).
