# GET / - Health Check

Endpoint simple para verificar que el servidor está corriendo correctamente.

---

## 📋 Información General

|                   |                 |
| ----------------- | --------------- |
| **Método**        | `GET`           |
| **URL**           | `/`             |
| **Autenticación** | ❌ No requerida |
| **Rol requerido** | Ninguno         |

---

## 📤 Request

### Headers

No se requieren headers especiales.

### Body

No requiere body.

### Ejemplo de URL

```
GET http://localhost:3001/
```

---

## 📥 Response

### Respuesta Exitosa (200 OK)

**Content-Type:** `text/html`

```
API running.
```

---

## 💻 Ejemplos de Código

### Dart/Flutter

```dart
import 'package:http/http.dart' as http;

Future<bool> checkApiStatus() async {
  try {
    final response = await http.get(
      Uri.parse('http://localhost:3001/'),
    );

    if (response.statusCode == 200) {
      print('✅ API está funcionando: ${response.body}');
      return true;
    } else {
      print('❌ API respondió con código: ${response.statusCode}');
      return false;
    }
  } catch (e) {
    print('❌ Error al conectar con la API: $e');
    return false;
  }
}
```

### cURL

```bash
curl http://localhost:3001/
```

### JavaScript/TypeScript

```javascript
const checkApiStatus = async () => {
  try {
    const response = await fetch('http://localhost:3001/');

    if (response.ok) {
      const text = await response.text();
      console.log('✅ API está funcionando:', text);
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Error al conectar con la API:', error);
    return false;
  }
};
```

---

## 🎯 Casos de Uso

### 1. Verificar conectividad al iniciar la app

```dart
Future<void> initializeApp() async {
  final isApiAvailable = await checkApiStatus();

  if (!isApiAvailable) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Error de Conexión'),
        content: Text('No se puede conectar con el servidor. Verifica tu conexión.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('OK'),
          ),
        ],
      ),
    );
  }
}
```

### 2. Monitoreo de estado del servidor

```dart
class ApiStatusWidget extends StatefulWidget {
  @override
  _ApiStatusWidgetState createState() => _ApiStatusWidgetState();
}

class _ApiStatusWidgetState extends State<ApiStatusWidget> {
  bool isOnline = false;

  @override
  void initState() {
    super.initState();
    _checkStatus();

    // Verificar cada 30 segundos
    Timer.periodic(Duration(seconds: 30), (_) => _checkStatus());
  }

  Future<void> _checkStatus() async {
    final status = await checkApiStatus();
    setState(() => isOnline = status);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(8),
      color: isOnline ? Colors.green : Colors.red,
      child: Row(
        children: [
          Icon(
            isOnline ? Icons.check_circle : Icons.error,
            color: Colors.white,
          ),
          SizedBox(width: 8),
          Text(
            isOnline ? 'Servidor conectado' : 'Servidor desconectado',
            style: TextStyle(color: Colors.white),
          ),
        ],
      ),
    );
  }
}
```

---

## ⚠️ Posibles Errores

| Error                  | Causa                             | Solución                             |
| ---------------------- | --------------------------------- | ------------------------------------ |
| **Connection refused** | Servidor no está corriendo        | Ejecutar `npm run dev` en el backend |
| **Network error**      | Sin conexión a internet           | Verificar conexión                   |
| **Timeout**            | Servidor sobrecargado o muy lento | Reintentar más tarde                 |

---

## 📝 Notas

- Este endpoint es útil para implementar un sistema de "heartbeat" o monitoreo.
- No consume recursos significativos, así que es seguro llamarlo frecuentemente.
- Es el único endpoint que no devuelve JSON, devuelve texto plano.

---

**Anterior**: [← Resumen de Endpoints](../02-endpoints-resumen.md)  
**Siguiente**: [POST /api/users/sync →](users-sync.md)
