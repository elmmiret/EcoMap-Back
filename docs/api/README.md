# 📚 Documentación de la API - PESkaos Backend

Bienvenido a la documentación de la API de PESkaos. Esta documentación está organizada para facilitar la navegación y el mantenimiento.

## 📂 Estructura de la Documentación

```
docs/api/
├── README.md                    # Este archivo (índice general)
├── 01-configuracion-general.md # Configuración base, URLs, autenticación
├── 02-endpoints-resumen.md     # Lista resumida de todos los endpoints
└── endpoints/                   # Documentación detallada de cada endpoint
    ├── health-check.md
    ├── users-sync.md
    └── ... (más endpoints)
```

## 🚀 Inicio Rápido

1. **[Configuración General](01-configuracion-general.md)**: Lee primero este documento para entender cómo funciona la autenticación y configuración base.

2. **[Resumen de Endpoints](02-endpoints-resumen.md)**: Vista rápida de todos los endpoints disponibles.

3. **[Endpoints Detallados](endpoints/)**: Documentación completa de cada endpoint con ejemplos y casos de uso.

## 🔗 Enlaces Rápidos

### Configuración

- [URLs Base y Entornos](01-configuracion-general.md#urls-base)
- [Autenticación con Firebase y JWT](01-configuracion-general.md#autenticación)
- [Manejo de Errores](01-configuracion-general.md#códigos-de-error)

### Endpoints Principales

- [POST /api/users/sync](endpoints/users-sync.md) - Sincronizar usuario y obtener JWT
- [GET /](endpoints/health-check.md) - Verificar estado del servidor

## 📱 Para Desarrolladores Frontend

Si estás trabajando con Flutter/Dart, cada documento de endpoint incluye:

- ✅ Ejemplos completos de código en Dart
- ✅ Manejo de errores específicos
- ✅ Dependencias necesarias
- ✅ Casos de uso comunes

## 🔄 Flujo de Autenticación

```
1. Usuario se autentica con Firebase
2. Frontend obtiene token de Firebase
3. Frontend llama a POST /api/users/sync con token de Firebase
4. Backend devuelve JWT propio del backend
5. Frontend usa JWT del backend en todas las peticiones siguientes
```

Ver detalles completos en [Configuración General](01-configuracion-general.md).

## 🆕 Últimas Actualizaciones

**23 de Octubre 2025**

- ✅ Sistema de JWT propio del backend implementado
- ✅ Endpoint de sincronización de usuarios con Prisma
- ✅ Documentación reorganizada en estructura modular

---

**Versión del API:** 1.0.0  
**Última actualización:** 23 de Octubre 2025
