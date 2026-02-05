# Guía de Configuración de Google Cloud

Para que la Agenda funcione, necesitamos crear una "identidad de robot" (Cuenta de Servicio) en Google que tenga permiso para ver y editar tus calendarios y contactos.

### Paso 1: Crear Proyecto
1. Ve a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un **Nuevo Proyecto** y llámalo "Isabel Agenda".

### Paso 2: Activar las APIs
1. En el buscador de arriba, busca y habilita estas 2 APIs:
   - **Google Calendar API**
   - **Google People API** (Esta es la de Contactos)

### Paso 3: Crear la Cuenta de Servicio (El Robot)
1. Ve al menú **IAM y administración** > **Cuentas de servicio**.
2. Dale a **+ CREAR CUENTA DE SERVICIO**.
3. Nombre: `agenda-bot`.
4. Dale a **Crear y Continuar**.
5. En rol, dale **Propietario** (o Editor) para asegurarnos de que no falle nada por permisos ahora.
6. Dale a **Listo**.

### Paso 4: Descargar la Llave (IMPORTANTE)
1. Haz clic en la cuenta de servicio que acabas de crear (ej: `agenda-bot@isabel-agenda...`).
2. Ve a la pestaña **Claves**.
3. **Agregar clave** > **Crear clave nueva**.
4. Selecciona **JSON** y dale a **Crear**.
5. Se descargará un archivo `.json` en tu ordenador. **¡GUÁRDALO!**
6. **Renombra ese archivo a `service-account.json` y súbelo a la carpeta del proyecto.**

### Paso 5: Dar permiso en el Calendario real
1. Abre ese archivo JSON con el bloc de notas y busca el `client_email` (será algo largo como `agenda-bot@isabel-agenda-123.iam.gserviceaccount.com`).
2. Ve a tu **Google Calendar** normal (donde tienes las citas).
3. Ve a **Configuración** de cada calendario de las peluqueras (o crea 3 calendarios nuevos: "Isabel", "Estilista 2", "Estilista 3").
4. En "Compartir con personas específicas", añade ese email (`agenda-bot@...`) y dale permiso de: **Hacer cambios en eventos**.

¡Y ya está! Cuando tengas el archivo `service-account.json` en la carpeta del proyecto, avísame.
