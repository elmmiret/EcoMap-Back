# Validación de Teléfono - Formato Requerido

## Formato esperado

```
+{prefijo} {número}
```

- **Prefijo**: 1 a 4 dígitos (código de país)
- **Espacio**: Un único espacio
- **Número**: 4 a 15 dígitos (sin espacios ni guiones)

---

## Ejemplos válidos

```javascript
"+34 612345678"     // España
"+1 5551234567"     // USA
"+44 7911123456"    // Reino Unido
"+33 612345678"     // Francia
"+49 15112345678"   // Alemania
```

---

## Ejemplos inválidos

```javascript
"612345678"           // ❌ Falta prefijo
"+34612345678"        // ❌ Falta espacio
"+34 612 345 678"     // ❌ Espacios extras en el número
"0034 612345678"      // ❌ No usar 00, debe ser +
"+34-612-345-678"     // ❌ No usar guiones
"+34 612 34 56 78"    // ❌ Espacios en el número
```

---

## Uso en el código

### 1. En endpoints (con middleware)

```javascript
import { validatePhone } from '#middlewares/validation.middleware.js';

// Aplicar middleware antes del controller
router.put('/api/users/me', 
  authenticateBackendJWT, 
  validatePhone,  // ← Valida y normaliza automáticamente
  updateUser
);
```

### 2. Validación manual (sin middleware)

```javascript
import { validateAndNormalizePhone } from '#lib/validators.js';

// En tu controller
const { valid, normalized, error } = validateAndNormalizePhone(req.body.phone);

if (!valid) {
  return res.status(400).json({
    success: false,
    message: error,
    code: 'INVALID_PHONE_FORMAT'
  });
}

// Usar el valor normalizado
await prisma.client.update({
  where: { user_id },
  data: { phone: normalized }
});
```

### 3. Solo validación (sin normalización)

```javascript
import { validatePhoneFormat } from '#lib/validators.js';

if (!validatePhoneFormat(phone)) {
  throw new Error('Formato de teléfono inválido');
}
```

### 4. Solo normalización

```javascript
import { normalizePhone } from '#lib/validators.js';

// Intenta normalizar (ej: "+34612345678" → "+34 612345678")
const normalized = normalizePhone(userInput);

if (!normalized) {
  // No se pudo normalizar, formato incorrecto
}
```

---

## Respuesta de error

Cuando la validación falla, el endpoint devuelve:

```json
{
  "success": false,
  "message": "Formato de teléfono inválido. Debe ser: +{prefijo} {número}. Ejemplo: +34 612345678",
  "code": "INVALID_PHONE_FORMAT",
  "hint": "El formato debe ser: +{prefijo} {número}. Ejemplo: +34 612345678"
}
```

---

## Normalización automática

El middleware **normaliza automáticamente** estos formatos:

```javascript
// Input del usuario → Guardado en BD
"+34612345678"       → "+34 612345678"
"+34  612345678"     → "+34 612345678"
"  +34 612345678  "  → "+34 612345678"
```

**No normaliza** (devuelve error):
```javascript
"612345678"          → Error (falta prefijo)
"+34 612 345 678"    → Error (espacios en número)
```

---

## Frontend: recomendaciones

### React/React Native ejemplo

```javascript
// Validar mientras el usuario escribe
const validatePhone = (value) => {
  const regex = /^\+\d{1,4}\s\d{4,15}$/;
  return regex.test(value);
};

// Componente
function PhoneInput({ value, onChange }) {
  const [error, setError] = useState('');

  const handleChange = (newValue) => {
    onChange(newValue);
    
    if (newValue && !validatePhone(newValue)) {
      setError('Formato: +34 612345678');
    } else {
      setError('');
    }
  };

  return (
    <div>
      <input 
        type="tel"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="+34 612345678"
      />
      {error && <span className="error">{error}</span>}
    </div>
  );
}
```

### Autocompletado de prefijo

```javascript
// Detectar país y añadir prefijo automático
const countryPrefixes = {
  ES: '+34',
  US: '+1',
  UK: '+44',
  FR: '+33',
  DE: '+49',
};

// Al seleccionar país, pre-rellenar
const [country, setCountry] = useState('ES');
const [phone, setPhone] = useState(countryPrefixes[country] + ' ');
```

---

## Testing

```javascript
import { validatePhoneFormat, normalizePhone } from '../lib/validators.js';

describe('Phone validation', () => {
  test('validates correct format', () => {
    expect(validatePhoneFormat('+34 612345678')).toBe(true);
    expect(validatePhoneFormat('+1 5551234567')).toBe(true);
  });

  test('rejects invalid formats', () => {
    expect(validatePhoneFormat('612345678')).toBe(false);
    expect(validatePhoneFormat('+34612345678')).toBe(false);
    expect(validatePhoneFormat('+34 612 345 678')).toBe(false);
  });

  test('normalizes phone numbers', () => {
    expect(normalizePhone('+34612345678')).toBe('+34 612345678');
    expect(normalizePhone('  +34 612345678  ')).toBe('+34 612345678');
  });

  test('returns null for invalid input', () => {
    expect(normalizePhone('612345678')).toBe(null);
    expect(normalizePhone('+34 612 345 678')).toBe(null);
  });
});
```

---

## Notas

- El campo `phone` en la BD es `String?` (nullable), así que `null` y `undefined` son válidos
- El middleware **no valida** si el número existe o es real, solo el formato
- La normalización elimina espacios extras pero **no añade el prefijo** si falta
- Prefijos soportados: 1-4 dígitos (cubre todos los países)
- Longitud del número: 4-15 dígitos (estándar internacional)
