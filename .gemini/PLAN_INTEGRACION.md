# 📋 Plan de Integración: Frontend ↔ Google Calendar/Contacts

## Estado Actual

### Frontend (Completo)
- ✅ **Header.tsx**: Navegación de fechas, selector de vista (Día/Semana), selector de peluquera
- ✅ **Column.tsx**: Columna de citas con drag-to-create, horarios configurables, citas visuales
- ✅ **NewAppointmentModal.tsx**: Modal para crear/editar citas con inputs de voz
- ✅ **VoiceButton.tsx**: Botón flotante de reconocimiento de voz (Web Speech API)
- ✅ **SettingsModal.tsx**: Configuración de estilistas y horarios (guardado en localStorage)
- ✅ **page.tsx**: Página principal con estado local (MOCK DATA) - 3 columnas, vistas día/semana

### Backend (Preparado)
- ✅ **lib/google.ts**: Cliente de Google APIs (Calendar + People)
- ✅ **api/calendar/route.ts**: GET (leer citas) y POST (crear citas)
- ✅ **api/contacts/route.ts**: GET (buscar contactos)
- ✅ **service-account.json**: Credenciales del robot
- ✅ **.env.local**: IDs de los 3 calendarios configurados

---

## 🎯 Requisitos del Proyecto (de description.txt)
1. **Facilidad de uso** como prioridad
2. **3 bloques de citas** (Isabel, Yolanda, Almudena)
3. **Coger citas con voz**
4. **Agregar nuevas clientas** de forma sencilla
5. **WhatsApp**: Enviar mensaje al crear cita + recordatorio a las 19:00 del día anterior

---

## 📝 Plan de Trabajo

### FASE 1: Sincronización de Citas (Lectura) ⏱️ 30 min
**Objetivo:** Las columnas muestran las citas REALES de Google Calendar

| Tarea | Archivo | Descripción |
|-------|---------|-------------|
| 1.1 | `page.tsx` | Reemplazar MOCK_DATA por fetch a `/api/calendar?date=YYYY-MM-DD` |
| 1.2 | `page.tsx` | Añadir `useEffect` para cargar citas cuando cambia la fecha |
| 1.3 | `page.tsx` | Añadir estado de loading mientras se cargan las citas |
| 1.4 | `api/calendar/route.ts` | Mapear `stylist` desde el calendarId (isabel/yolanda/almudena → nombre) |

### FASE 2: Crear Citas en Google Calendar ⏱️ 20 min
**Objetivo:** Al guardar una cita en el modal, se crea en Google Calendar

| Tarea | Archivo | Descripción |
|-------|---------|-------------|
| 2.1 | `NewAppointmentModal.tsx` | Modificar `onSave` para incluir `date` (selectedDate) |
| 2.2 | `page.tsx` | En `handleSaveAppointment`, hacer POST a `/api/calendar` |
| 2.3 | `api/calendar/route.ts` | Recibir `clientName`, `service`, `stylist`, `startTime`, `duration` y crear evento |
| 2.4 | `page.tsx` | Después de guardar, re-fetch de citas para actualizar vista |

### FASE 3: Autocompletar Clientes (Contacts) ⏱️ 20 min
**Objetivo:** Al escribir un nombre en el modal, sugiere clientes de Google Contacts

| Tarea | Archivo | Descripción |
|-------|---------|-------------|
| 3.1 | `NewAppointmentModal.tsx` | Añadir estado para `suggestions[]` y `showSuggestions` |
| 3.2 | `NewAppointmentModal.tsx` | Añadir `useEffect` con debounce que busca en `/api/contacts?q=...` |
| 3.3 | `NewAppointmentModal.tsx` | Renderizar dropdown de sugerencias bajo el input de cliente |
| 3.4 | `NewAppointmentModal.tsx` | Al seleccionar sugerencia, rellenar nombre y guardar teléfono (para WhatsApp) |

### FASE 4: Crear Nueva Clienta ⏱️ 15 min
**Objetivo:** Botón para añadir cliente nuevo a Google Contacts

| Tarea | Archivo | Descripción |
|-------|---------|-------------|
| 4.1 | `lib/google.ts` | Añadir función `createContact(name, phone)` |
| 4.2 | `api/contacts/route.ts` | Añadir método POST para crear contacto |
| 4.3 | `NewAppointmentModal.tsx` | Si no hay sugerencias, mostrar botón "+ Añadir como nueva clienta" |

### FASE 5: Integración de Voz Mejorada ⏱️ 25 min
**Objetivo:** El botón de voz entiende frases y rellena el formulario

| Tarea | Archivo | Descripción |
|-------|---------|-------------|
| 5.1 | `lib/voiceParser.ts` | Crear parser de comandos de voz (regex/NLP simple) |
| 5.2 | Ejemplos de frases: |
|     | | "Cita para María López el lunes a las 10" |
|     | | "Tinte para Carmen a las 5 con Isabel" |
| 5.3 | `VoiceButton.tsx` | Al terminar de hablar, parsear y abrir modal con datos rellenos |
| 5.4 | `page.tsx` | Conectar `onVoiceResult` del botón con el parser y el modal |

### FASE 6: WhatsApp con WAHA ⏱️ 40 min (requiere servidor)
**Objetivo:** Enviar mensajes de WhatsApp automáticos

| Tarea | Archivo | Descripción |
|-------|---------|-------------|
| 6.1 | Desplegar WAHA en VPS (Docker) | `docker run -d -p 3001:3000 devlikeapro/waha` |
| 6.2 | `lib/whatsapp.ts` | Crear cliente para API de WAHA |
| 6.3 | `api/calendar/route.ts` | Después de crear cita, enviar mensaje de confirmación |
| 6.4 | Crear CRON job | Script que a las 19:00 busca citas del día siguiente y envía recordatorio |

---

## 🔧 Orden de Ejecución Recomendado

```
FASE 1 → FASE 2 → FASE 3 → FASE 4 → FASE 5 → FASE 6
[Lectura] → [Escritura] → [Contacts] → [Nueva Clienta] → [Voz] → [WhatsApp]
```

**Nota:** Las fases 1-5 son 100% locales (no requieren servidor). La fase 6 requiere configurar WAHA en una VPS.

---

## 📁 Estructura de Archivos Final

```
app/
├── app/
│   ├── api/
│   │   ├── calendar/route.ts    # GET/POST citas
│   │   ├── contacts/route.ts    # GET/POST contactos
│   │   └── whatsapp/route.ts    # POST mensajes (Fase 6)
│   ├── page.tsx                 # Página principal (sincronizada)
│   └── globals.css
├── components/
│   ├── Column.tsx
│   ├── Header.tsx
│   ├── NewAppointmentModal.tsx  # Con autocompletado
│   ├── SettingsModal.tsx
│   └── VoiceButton.tsx          # Con parser de comandos
├── lib/
│   ├── google.ts                # Cliente Google APIs
│   ├── voiceParser.ts           # Parser de comandos de voz (Fase 5)
│   └── whatsapp.ts              # Cliente WAHA (Fase 6)
├── utils/
│   └── schedule.ts
├── .env.local                   # Calendar IDs
└── service-account.json         # Credenciales (NO subir a git)
```

---

## ⚡ Siguiente Paso Inmediato

**Empezar por FASE 1:** Conectar las columnas con los datos reales de Google Calendar.

¿Procedemos?
