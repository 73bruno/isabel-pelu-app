# Resumen Técnico de Implementación - Isabel PeluApp

## 1. Arquitectura General
La aplicación está construida sobre **Next.js (App Router)** utilizando **React** y **TypeScript**. El estilado se maneja con **Tailwind CSS**.

### Stack Tecnológico
| Componente | Tecnología |
|------------|------------|
| Frontend | React 18, Next.js 14, Tailwind CSS |
| Backend (API) | Next.js API Routes |
| Persistencia Citas | Google Calendar API |
| Persistencia Config | localStorage (cliente) |
| Autenticación | NextAuth.js (Google Provider) |

---

## 2. Integración con Google Calendar

### Service Account
- Autenticación via **Service Account** de Google Cloud (`lib/google.ts`)
- Permisos de delegación o compartición directa de calendarios

### API Wrapper (`/api/calendar`)

Endpoints disponibles:
| Método | Acción |
|--------|--------|
| GET | Obtener eventos de una fecha |
| POST | Crear nuevo evento |
| PUT | Actualizar evento existente |
| DELETE | Eliminar evento |

### Soporte Multi-Calendario (hasta 5)
```
CALENDAR_ISABEL    → isabel
CALENDAR_YOLANDA   → yolanda
CALENDAR_ALMUDENA  → almudena
CALENDARIO_4       → stylist4
CALENDARIO_5       → stylist5
```

### Sistema de Caché
Para evitar el error `Quota Exceeded` de Google API:

- **Caché en memoria** con TTL de 60 segundos
- **Invalidación automática** en operaciones de escritura (POST/PUT/DELETE)
- **Manejo de error 429** con mensaje amigable al usuario

```typescript
const CACHE: Map<string, { data: any, timestamp: number }> = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minuto
```

---

## 3. Gestión Dinámica de Estilistas

### Estructura de Configuración
```typescript
interface StylistConfig {
  id: string;
  name: string;
  calendarId: string;      // ej: 'stylist4'
  color: { bg, border, text };
  order: number;
  isActive: boolean;
}
```

### Funcionalidades
- ✅ Añadir nuevas peluqueras (hasta 5)
- ✅ Eliminar peluqueras (con confirmación)
- ✅ Renombrar sin perder asociación al calendario
- ✅ Reordenar columnas (drag & drop / flechas)
- ✅ Activar/desactivar visibilidad
- ✅ Colores personalizados por estilista

### Flujo de Asignación de Calendarios
1. Al crear nueva peluquera, busca el primer slot libre (`stylist4`, `stylist5`)
2. El `calendarId` se guarda en localStorage
3. `fetchAppointments` mapea eventos del API al nombre configurado

---

## 4. Control de Horarios

### Configuración de Horario (`utils/schedule.ts`)
```typescript
type Schedule = {
  [dayOfWeek: number]: number[][]; // ej: [[9, 14], [16, 20]]
};

// Ejemplo: Jueves partido
4: [[9, 13], [16, 20]]
```

### Validación de Horarios
Implementada en dos niveles:

1. **En `Column.tsx`** (Drag & Drop)
   - Bloquea inicio de arrastre en horas cerradas
   - Indicación visual con franjas grises

2. **En `NewAppointmentModal.tsx`** (Input manual)
   - Validación al guardar con mensaje de error
   - Input se marca en rojo si hora inválida

### Regla de Negocio
> Las citas pueden **EMPEZAR** solo dentro del horario de apertura.
> Si empiezan dentro, pueden **EXTENDERSE** fuera (ej: última cita del día).

---

## 5. Interfaz de Usuario

### Vistas Principales
| Vista | Descripción |
|-------|-------------|
| Día | Columnas paralelas por estilista activo |
| Semana | Grid general (Lunes a Sábado) |

### Modal de Citas
- Autocompletado de clientes (Google Contacts API)
- Reconocimiento de voz (Web Speech API)
- Selectores de hora, duración, estilista
- Validación de horarios con feedback visual

### Panel de Configuración (SettingsModal)
- Gestión de peluqueras (CRUD)
- Configuración de horarios por día
- Modo claro/oscuro

---

## 6. Optimizaciones de Rendimiento

### Prevención de Loops Infinitos
- `useMemo` para cálculos derivados (`activeStylists`, `stylistColors`)
- Dependencias calculadas localmente en `useCallback` (no referencia a estado memoizado)

### Caché de API
- Reduce llamadas a Google Calendar API de 5/request a 1/minuto por fecha
- Respuestas cacheadas en ~3ms vs ~400ms sin caché

---

## 7. Variables de Entorno

```env
# NextAuth
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_SECRET=...

# Google Calendar Service Account
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY=...

# Calendar IDs (hasta 5)
CALENDAR_ISABEL=...
CALENDAR_YOLANDA=...
CALENDAR_ALMUDENA=...
CALENDARIO_4=...
CALENDARIO_5=...

# Google Contacts (opcional)
GOOGLE_CONTACTS_REFRESH_TOKEN=...
```

---

## 8. Próximos Pasos

### Integración WhatsApp (WAHA)
- [ ] Configurar VPS con Docker
- [ ] Desplegar WAHA (WhatsApp HTTP API)
- [ ] Crear endpoint `/api/reminders`
- [ ] Implementar cron job para envío de recordatorios
- [ ] UI para gestión de recordatorios por cliente

---

## 9. Estructura de Archivos Clave

```
app/
├── app/
│   ├── page.tsx              # Página principal (tablero)
│   └── api/
│       ├── calendar/route.ts # API Google Calendar
│       └── contacts/route.ts # API Google Contacts
├── components/
│   ├── Column.tsx            # Columna de citas
│   ├── NewAppointmentModal.tsx # Modal crear/editar cita
│   ├── SettingsModal.tsx     # Configuración
│   └── Header.tsx            # Cabecera
├── utils/
│   └── schedule.ts           # Utilidades de horario
└── lib/
    └── google.ts             # Cliente Google Calendar
```