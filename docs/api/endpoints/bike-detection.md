# POST /api/bikes - Detección de Bicicletas con IA

Servicio externo de detección de bicicletas en imágenes utilizando modelo YOLO desplegado en HuggingFace Spaces.

---

## 📋 Información General

|                   |                            |
| ----------------- | -------------------------- |
| **Método**        | `POST`                     |
| **URL**           | `/api/bikes`               |
| **Autenticación** | ❌ No requerida            |
| **Content-Type**  | `multipart/form-data`      |
| **Timeout**       | ~5-10 segundos (depende de tamaño de imagen) |

---

## 📝 Descripción

Este endpoint recibe una imagen y detecta si contiene una o más bicicletas utilizando un modelo YOLO (You Only Look Once) de detección de objetos. 

**Flujo interno:**
1. Cliente envía imagen a la API de EcoMap
2. Backend reenvía la imagen al modelo YOLO en HuggingFace Spaces
3. Modelo procesa y devuelve detecciones
4. Backend filtra detecciones de bicicletas y responde al cliente

**Casos de uso:**
- Validar que usuarios suban fotos de bicicletas en publicaciones
- Verificar contenido de imágenes antes de almacenar
- Sistema de moderación automática de contenido
- Gamificación: detectar si el usuario llegó en bici

---

## 📤 Request

### Headers

```
Content-Type: multipart/form-data
```

### Body (Form Data)

| Campo   | Tipo   | Requerido | Descripción                                  |
| ------- | ------ | --------- | -------------------------------------------- |
| `image` | File   | ✅ Sí     | Archivo de imagen (JPEG, PNG, WebP, etc.)    |

**Restricciones:**
- Tamaño máximo: **10 MB**
- Formatos soportados: Todos los formatos de imagen estándar (JPEG, PNG, WebP, BMP, GIF, etc.)
- La imagen debe ser válida y legible

### Ejemplo de Request

**cURL:**
```bash
curl -X POST http://localhost:3001/api/bikes \
  -F "image=@/ruta/a/tu/bicicleta.jpg"
```

**cURL con headers verbose:**
```bash
curl -X POST http://localhost:3001/api/detect-bike \
  -F "image=@bike_photo.jpg" \
  -H "Accept: application/json" \
  -v
```

---

## 📥 Response

### Respuesta Exitosa (200 OK)

**Content-Type:** `application/json`

```json
{
  "success": true,
  "hasBike": true,
  "confidence": 0.917655348777771,
  "detections": 1,
  "details": [
    {
      "class": 0,
      "class_name": "bicycle",
      "confidence": 0.917655348777771,
      "bbox": [407.56, 360.38, 1007.10, 675.0]
    }
  ]
}
```

**Campos de respuesta:**

| Campo         | Tipo      | Descripción                                                    |
| ------------- | --------- | -------------------------------------------------------------- |
| `success`     | Boolean   | Indica si la petición se procesó correctamente                 |
| `hasBike`     | Boolean   | `true` si se detectó al menos una bicicleta                    |
| `confidence`  | Number    | Confianza máxima de las detecciones (0.0 - 1.0), `null` si no hay detecciones |
| `detections`  | Number    | Cantidad total de bicicletas detectadas                        |
| `details`     | Array     | Lista de detecciones con información detallada                 |

**Campos de cada detección en `details`:**

| Campo         | Tipo      | Descripción                                                    |
| ------------- | --------- | -------------------------------------------------------------- |
| `class`       | Number    | ID de clase YOLO (0 = bicycle)                                 |
| `class_name`  | String    | Nombre de la clase detectada ("bicycle")                       |
| `confidence`  | Number    | Nivel de confianza de esta detección (0.0 - 1.0)              |
| `bbox`        | Array     | Bounding box `[x1, y1, x2, y2]` en píxeles                     |

### Respuesta: No se detectaron bicicletas (200 OK)

```json
{
  "success": true,
  "hasBike": false,
  "confidence": null,
  "detections": 0,
  "details": []
}
```

### Respuesta: Múltiples bicicletas detectadas (200 OK)

```json
{
  "success": true,
  "hasBike": true,
  "confidence": 0.95,
  "detections": 3,
  "details": [
    {
      "class": 0,
      "class_name": "bicycle",
      "confidence": 0.95,
      "bbox": [100.5, 200.3, 350.8, 500.2]
    },
    {
      "class": 0,
      "class_name": "bicycle",
      "confidence": 0.88,
      "bbox": [400.1, 180.5, 650.3, 480.9]
    },
    {
      "class": 0,
      "class_name": "bicycle",
      "confidence": 0.76,
      "bbox": [700.2, 220.1, 920.5, 510.8]
    }
  ]
}
```

---

## ⚠️ Errores

### 400 Bad Request - No se proporcionó imagen

```json
{
  "success": false,
  "error": "No image file provided. Please upload an image with key \"image\""
}
```

**Causa:** No se incluyó el campo `image` en el form-data.

### 400 Bad Request - Archivo muy grande

```json
{
  "success": false,
  "error": "File too large. Maximum size is 10MB"
}
```

**Causa:** La imagen supera el límite de 10 MB.

### 400 Bad Request - Archivo no es una imagen

```json
{
  "success": false,
  "error": "Only image files are allowed"
}
```

**Causa:** El archivo subido no tiene un MIME type de imagen (ej. se subió un PDF, TXT, etc.).

### 503 Service Unavailable - Servicio externo caído

```json
{
  "success": false,
  "error": "External detection service unavailable",
  "message": "HF Spaces API error: 503 Service Unavailable"
}
```

**Causa:** El modelo YOLO en HuggingFace Spaces no está disponible temporalmente.

**Solución:** Reintentar después de unos segundos. Si persiste, contactar soporte.

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Internal server error during bike detection",
  "message": "..."
}
```

**Causa:** Error inesperado en el procesamiento interno.

---

## 💻 Ejemplos de Código

### Dart/Flutter

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:io';

Future<Map<String, dynamic>> detectBikeInImage(File imageFile) async {
  try {
    final uri = Uri.parse('http://localhost:3001/api/bikes');
    final request = http.MultipartRequest('POST', uri);
    
    // Añadir la imagen al request
    request.files.add(
      await http.MultipartFile.fromPath(
        'image',
        imageFile.path,
      ),
    );
    
    // Enviar request
    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      print('✅ Detección exitosa');
      print('¿Hay bicicleta? ${data['hasBike']}');
      print('Confianza: ${data['confidence']}');
      print('Cantidad detectada: ${data['detections']}');
      return data;
    } else {
      print('❌ Error ${response.statusCode}: ${response.body}');
      throw Exception('Detection failed');
    }
  } catch (e) {
    print('❌ Error: $e');
    rethrow;
  }
}

// Uso
void main() async {
  final imageFile = File('/path/to/bike.jpg');
  final result = await detectBikeInImage(imageFile);
  
  if (result['hasBike']) {
    print('🚴 ¡Bicicleta detectada con ${(result['confidence'] * 100).toStringAsFixed(1)}% de confianza!');
  } else {
    print('❌ No se detectó ninguna bicicleta');
  }
}
```

### JavaScript/Node.js (con FormData)

```javascript
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function detectBike(imagePath) {
  const formData = new FormData();
  formData.append('image', fs.createReadStream(imagePath));

  const response = await fetch('http://localhost:3001/api/bikes', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  
  console.log('Resultado:', result);
  
  if (result.hasBike) {
    console.log(`🚴 Bicicleta detectada con ${(result.confidence * 100).toFixed(1)}% de confianza`);
  } else {
    console.log('❌ No se detectó bicicleta');
  }
  
  return result;
}

// Uso
detectBike('./bike_photo.jpg');
```

### Python (con requests)

```python
import requests

def detect_bike(image_path):
    url = 'http://localhost:3001/api/bikes'
    
    with open(image_path, 'rb') as image_file:
        files = {'image': image_file}
        response = requests.post(url, files=files)
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Detección exitosa")
        print(f"¿Hay bicicleta? {result['hasBike']}")
        print(f"Confianza: {result['confidence']}")
        print(f"Detecciones: {result['detections']}")
        
        for i, detection in enumerate(result['details']):
            print(f"  Bici #{i+1}: {detection['confidence']:.2%} confianza")
            print(f"    Posición: {detection['bbox']}")
        
        return result
    else:
        print(f"❌ Error {response.status_code}: {response.text}")
        return None

# Uso
result = detect_bike('bike_photo.jpg')
if result and result['hasBike']:
    print("🚴 ¡Bicicleta confirmada!")
```

### cURL (detallado)

```bash
# Detección simple
curl -X POST http://localhost:3001/api/detect-bike \
  -F "image=@bike.jpg"

# Con pretty print JSON
curl -X POST http://localhost:3001/api/detect-bike \
  -F "image=@bike.jpg" \
  | jq '.'

# Guardar respuesta en archivo
curl -X POST http://localhost:3001/api/detect-bike \
  -F "image=@bike.jpg" \
  -o result.json

# Con timeout y retry
curl -X POST http://localhost:3001/api/detect-bike \
  -F "image=@bike.jpg" \
  --max-time 30 \
  --retry 3 \
  --retry-delay 2
```

---

## 🔍 Notas Técnicas

### Sobre el modelo YOLO

- **Modelo utilizado:** YOLOv8 (o similar) entrenado en COCO dataset
- **Clases detectadas:** Solo bicicletas (`class_name: "bicycle"`)
- **Precisión:** Variable según calidad de imagen, iluminación y ángulo
- **Tiempo de respuesta:** 2-5 segundos típicamente

### Bounding Box (bbox)

El array `bbox` contiene 4 valores que representan el rectángulo que encierra la bicicleta:

```
[x1, y1, x2, y2]
```

- `x1, y1`: Coordenadas de la esquina superior izquierda (en píxeles)
- `x2, y2`: Coordenadas de la esquina inferior derecha (en píxeles)

**Ejemplo:**
```json
"bbox": [407.56, 360.38, 1007.10, 675.0]
```
Significa:
- Inicia en posición X=407.56, Y=360.38
- Termina en posición X=1007.10, Y=675.0
- Ancho: 1007.10 - 407.56 = 599.54 px
- Alto: 675.0 - 360.38 = 314.62 px

### Nivel de confianza

El campo `confidence` indica qué tan seguro está el modelo de que detectó una bicicleta:

| Rango       | Interpretación                |
| ----------- | ----------------------------- |
| 0.90 - 1.00 | Muy alta confianza ✅         |
| 0.75 - 0.89 | Alta confianza                |
| 0.50 - 0.74 | Confianza media ⚠️            |
| 0.00 - 0.49 | Baja confianza (filtrado) ❌  |

**Nota:** El modelo suele filtrar detecciones con confianza < 0.5 automáticamente.

### Optimización de imágenes

Para mejores resultados:

1. **Resolución recomendada:** 640x640 a 1920x1080 px
2. **Tamaño de archivo:** < 2 MB (el límite es 10 MB pero imágenes más pequeñas son más rápidas)
3. **Formato:** JPEG con calidad 80-90% es óptimo
4. **Iluminación:** Imágenes bien iluminadas mejoran la detección
5. **Ángulo:** Vistas laterales o frontales funcionan mejor que vistas aéreas

**Ejemplo de redimensionamiento antes de enviar:**

```dart
// Flutter
import 'package:image/image.dart' as img;

Future<File> optimizeImage(File imageFile) async {
  final bytes = await imageFile.readAsBytes();
  final image = img.decodeImage(bytes);
  
  if (image == null) return imageFile;
  
  // Redimensionar si es muy grande
  final resized = image.width > 1920 
    ? img.copyResize(image, width: 1920)
    : image;
  
  // Comprimir a JPEG 85%
  final compressed = img.encodeJpg(resized, quality: 85);
  
  final tempFile = File('${imageFile.path}_optimized.jpg');
  await tempFile.writeAsBytes(compressed);
  
  return tempFile;
}
```

---

## 🚀 Integración Recomendada

### Flujo típico en aplicación móvil

```dart
// 1. Usuario toma foto o selecciona de galería
final ImagePicker picker = ImagePicker();
final XFile? photo = await picker.pickImage(source: ImageSource.camera);

if (photo == null) return;

// 2. Mostrar loading
showDialog(context: context, builder: (_) => LoadingDialog());

try {
  // 3. Optimizar imagen (opcional pero recomendado)
  final optimized = await optimizeImage(File(photo.path));
  
  // 4. Enviar a API
  final result = await detectBikeInImage(optimized);
  
  // 5. Procesar resultado
  Navigator.pop(context); // cerrar loading
  
  if (result['hasBike']) {
    if (result['confidence'] > 0.8) {
      // Alta confianza: auto-aprobar
      showSuccessDialog('¡Bicicleta detectada! ✅');
    } else {
      // Confianza media: pedir confirmación manual
      showConfirmDialog('Se detectó una posible bicicleta. ¿Confirmar?');
    }
  } else {
    showErrorDialog('No se detectó ninguna bicicleta. Por favor toma otra foto.');
  }
  
} catch (e) {
  Navigator.pop(context);
  showErrorDialog('Error al procesar imagen: $e');
}
```

---

## 🛡️ Consideraciones de Seguridad

1. **Rate limiting:** Se recomienda implementar rate limiting en producción (ej. 10 requests/minuto por IP)
2. **Validación de tamaño:** Ya implementado (máx 10 MB)
3. **Validación de tipo MIME:** Ya implementado (solo imágenes)
4. **No se almacenan imágenes:** Las imágenes se procesan en memoria y se descartan inmediatamente
5. **Datos sensibles:** No envíes imágenes con información personal/privada

---

## 📊 Métricas y Monitoreo

El endpoint registra logs con la siguiente información:

```javascript
// Log de entrada
{
  "level": "info",
  "message": "Processing bike detection request",
  "filename": "bike_photo.jpg",
  "mimetype": "image/jpeg",
  "size": 2048576
}

// Log de resultado
{
  "level": "info",
  "message": "Bike detection result",
  "hasBike": true,
  "confidence": 0.917,
  "totalDetections": 1,
  "bikeDetections": 1
}
```

---

## 🔗 Enlaces Relacionados

- [Modelo YOLO en HuggingFace Spaces](https://tacosrra-ecomap-ai.hf.space)
- [Documentación de YOLO](https://docs.ultralytics.com/)
- [API Principal - Recycling Points](./recycling-points-region.md)

---

## 📞 Soporte

Si encuentras problemas con este endpoint:

1. Verifica que la imagen sea válida y < 10 MB
2. Comprueba que el servidor HuggingFace Spaces esté activo
3. Revisa los logs del servidor para más detalles
4. Contacta al equipo de desarrollo con el error específico

**Repositorio:** [PESkaos-back](https://github.com/pes2526q1-1x-gei-upc/PESkaos-back)
