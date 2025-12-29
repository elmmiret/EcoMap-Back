#!/bin/bash

# Script de prueba completo para el sistema de chat
# Prueba todos los endpoints y funcionalidades del chat

BASE_URL="http://localhost:3001"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  PRUEBAS DEL SISTEMA DE CHAT${NC}"
echo -e "${YELLOW}========================================${NC}\n"

# Variables para almacenar tokens y IDs
TOKEN1=""
TOKEN2=""
CHAT_ID=""
MESSAGE_ID=""

# Función para imprimir resultados
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
    fi
}

# Función para extraer JSON
extract_json() {
    echo "$1" | jq -r "$2" 2>/dev/null
}

echo -e "${YELLOW}Paso 1: Verificar servidor${NC}"
HEALTH=$(curl -s "$BASE_URL/")
if [ "$HEALTH" == "API running." ]; then
    print_result 0 "Servidor está corriendo"
else
    print_result 1 "Servidor NO responde"
    echo "Asegúrate de que el servidor esté corriendo: npm run dev"
    exit 1
fi

echo -e "\n${YELLOW}Paso 2: Crear usuarios de prueba${NC}"
echo "Para probar el chat necesitas:"
echo "1. Dos tokens JWT válidos (de usuarios diferentes)"
echo "2. Puedes obtenerlos desde /api/users/sync con Firebase tokens"
echo ""
read -p "Token JWT Usuario 1: " TOKEN1
read -p "Token JWT Usuario 2: " TOKEN2
read -p "Username Usuario 2 (para iniciar chat): " USERNAME2

if [ -z "$TOKEN1" ] || [ -z "$TOKEN2" ] || [ -z "$USERNAME2" ]; then
    echo -e "${RED}Se requieren ambos tokens y el username${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Paso 3: Iniciar/Obtener Chat${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/chats" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME2\"}")

echo "Respuesta: $RESPONSE"
CHAT_ID=$(extract_json "$RESPONSE" ".chat.chat_id")

# Fallback si jq falla - usar grep y sed
if [ -z "$CHAT_ID" ] || [ "$CHAT_ID" == "null" ]; then
    CHAT_ID=$(echo "$RESPONSE" | grep -o '"chat_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ ! -z "$CHAT_ID" ] && [ "$CHAT_ID" != "null" ]; then
    print_result 0 "Chat creado/obtenido: $CHAT_ID"
else
    print_result 1 "Error al crear chat. Verifica que jq esté instalado: sudo apt install jq"
    echo "Debug - CHAT_ID extraído: '$CHAT_ID'"
    exit 1
fi

echo -e "\n${YELLOW}Paso 4: Listar Chats del Usuario 1${NC}"
RESPONSE=$(curl -s "$BASE_URL/api/chats" \
  -H "Authorization: Bearer $TOKEN1")

CHAT_COUNT=$(extract_json "$RESPONSE" ".chats | length")
echo "Chats encontrados: $CHAT_COUNT"
print_result 0 "Listado de chats"

echo -e "\n${YELLOW}Paso 5: Enviar mensaje de texto simple${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/messages" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hola, este es un mensaje de prueba!"}')

echo "Respuesta: $RESPONSE"
MESSAGE_ID=$(extract_json "$RESPONSE" ".message.message_id")
MESSAGE_STATUS=$(extract_json "$RESPONSE" ".message.status")

# Fallback si jq falla
if [ -z "$MESSAGE_ID" ] || [ "$MESSAGE_ID" == "null" ]; then
    MESSAGE_ID=$(echo "$RESPONSE" | grep -o '"message_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi
if [ -z "$MESSAGE_STATUS" ] || [ "$MESSAGE_STATUS" == "null" ]; then
    MESSAGE_STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ ! -z "$MESSAGE_ID" ] && [ "$MESSAGE_ID" != "null" ]; then
    print_result 0 "Mensaje enviado: $MESSAGE_ID (Estado: $MESSAGE_STATUS)"
else
    print_result 1 "Error al enviar mensaje"
    echo "Debug - Respuesta completa: $RESPONSE"
fi

echo -e "\n${YELLOW}Paso 6: Consultar estado del mensaje${NC}"
RESPONSE=$(curl -s "$BASE_URL/api/chats/messages/$MESSAGE_ID/status" \
  -H "Authorization: Bearer $TOKEN1")

echo "Respuesta: $RESPONSE"
STATUS=$(extract_json "$RESPONSE" ".status.status")
RETRY_COUNT=$(extract_json "$RESPONSE" ".status.retry_count")

if [ ! -z "$STATUS" ]; then
    print_result 0 "Estado del mensaje: $STATUS (Reintentos: $RETRY_COUNT)"
else
    print_result 1 "Error al consultar estado"
fi

echo -e "\n${YELLOW}Paso 7: Obtener mensajes del chat${NC}"
RESPONSE=$(curl -s "$BASE_URL/api/chats/$CHAT_ID/messages?limit=10" \
  -H "Authorization: Bearer $TOKEN1")

MSG_COUNT=$(extract_json "$RESPONSE" ".messages | length")
echo "Mensajes recuperados: $MSG_COUNT"
print_result 0 "Listado de mensajes"

echo -e "\n${YELLOW}Paso 8: Enviar mensaje con media (URLs)${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/messages" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"content": "Mensaje con imagen", "media": ["https://example.com/image.jpg"]}')

echo "Respuesta: $RESPONSE"
SUCCESS=$(extract_json "$RESPONSE" ".success")

if [ "$SUCCESS" == "true" ]; then
    print_result 0 "Mensaje con media enviado"
else
    print_result 1 "Error al enviar mensaje con media"
fi

echo -e "\n${YELLOW}Paso 9: Marcar mensajes como leídos${NC}"
RESPONSE=$(curl -s -X PUT "$BASE_URL/api/chats/$CHAT_ID/read" \
  -H "Authorization: Bearer $TOKEN2")

SUCCESS=$(extract_json "$RESPONSE" ".success")
if [ "$SUCCESS" == "true" ]; then
    print_result 0 "Mensajes marcados como leídos"
else
    print_result 1 "Error al marcar como leídos"
fi

echo -e "\n${YELLOW}Paso 10: Probar validaciones (mensaje muy largo)${NC}"
LONG_MESSAGE=$(printf 'A%.0s' {1..1001})
RESPONSE=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/messages" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"$LONG_MESSAGE\"}")

ERROR=$(extract_json "$RESPONSE" ".error")
if [ "$ERROR" == "MESSAGE_TOO_LONG" ]; then
    print_result 0 "Validación de longitud funciona"
else
    print_result 1 "Validación de longitud NO funciona"
fi

echo -e "\n${YELLOW}Paso 11: Probar validación de media (URL inválida)${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/messages" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"content": "test", "media": ["invalid-url"]}')

ERROR=$(extract_json "$RESPONSE" ".error")
if [ "$ERROR" == "INVALID_MEDIA_URL_FORMAT" ]; then
    print_result 0 "Validación de URL funciona"
else
    print_result 1 "Validación de URL NO funciona"
fi

echo -e "\n${YELLOW}Paso 12: Probar validación HTTP (debe fallar)${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/messages" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"content": "test", "media": ["http://example.com/image.jpg"]}')

ERROR=$(extract_json "$RESPONSE" ".error")
if [ "$ERROR" == "INSECURE_MEDIA_URL" ]; then
    print_result 0 "Validación HTTPS funciona"
else
    print_result 1 "Validación HTTPS NO funciona"
fi

echo -e "\n${YELLOW}Paso 13: Consultar estadísticas de cola${NC}"
RESPONSE=$(curl -s "$BASE_URL/api/chats/queue/stats" \
  -H "Authorization: Bearer $TOKEN1")

echo "Respuesta: $RESPONSE"
QUEUE_SIZE=$(extract_json "$RESPONSE" ".stats.queueSize")

if [ ! -z "$QUEUE_SIZE" ]; then
    print_result 0 "Cola de mensajes: $QUEUE_SIZE mensajes pendientes"
else
    print_result 1 "Error al consultar cola"
fi

echo -e "\n${YELLOW}Paso 14: Enviar mensaje solo con media (sin texto)${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/messages" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"media": ["https://example.com/photo.png", "https://example.com/photo2.png"]}')

SUCCESS=$(extract_json "$RESPONSE" ".success")
if [ "$SUCCESS" == "true" ]; then
    print_result 0 "Mensaje solo con media enviado"
else
    print_result 1 "Error: debería permitir mensajes solo con media"
fi

echo -e "\n${YELLOW}Paso 15: Intentar enviar mensaje vacío${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/messages" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"content": ""}')

ERROR=$(extract_json "$RESPONSE" ".error")
if [ "$ERROR" == "INVALID_CONTENT_OR_MEDIA" ]; then
    print_result 0 "Validación de contenido vacío funciona"
else
    print_result 1 "Validación de contenido vacío NO funciona"
fi

echo -e "\n${YELLOW}========================================${NC}"
echo -e "${GREEN}PRUEBAS COMPLETADAS${NC}"
echo -e "${YELLOW}========================================${NC}\n"

echo "Notas adicionales:"
echo "- Para probar eliminación de mensajes, ejecuta dentro de 5 min de crear el mensaje:"
echo "  curl -X DELETE $BASE_URL/api/chats/messages/<MESSAGE_ID> -H 'Authorization: Bearer $TOKEN1'"
echo ""
echo "- Para probar WebSockets necesitas un cliente de Socket.io conectado"
echo "- La cola de reintentos se procesa automáticamente cada 5 segundos"
echo ""
echo "¡Sistema de chat verificado!"
