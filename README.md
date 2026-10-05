# 🎫 Bot de Tickets para Discord

Bot de **Atención al Cliente** para Discord: los clientes abren un ticket con un botón, el bot crea un **canal privado** y lo asigna automáticamente a **un agente** del equipo. Todo queda registrado en una base de datos **SQLite** local, así que el sistema sigue funcionando aunque el bot o la computadora se reinicien.

Hecho con **Node.js + TypeScript + discord.js v14 + SQLite (better-sqlite3) + dotenv**.

---

## Índice

1. [Qué hace el bot](#1-qué-hace-el-bot)
2. [Requisitos](#2-requisitos)
3. [Instalar Node.js](#3-instalar-nodejs)
4. [Instalar las dependencias](#4-instalar-las-dependencias)
5. [Crear la aplicación en el Developer Portal](#5-crear-la-aplicación-en-el-developer-portal)
6. [Crear el bot](#6-crear-el-bot)
7. [Obtener el token](#7-obtener-el-token)
8. [Activar los intents](#8-activar-los-intents)
9. [Invitar el bot al servidor](#9-invitar-el-bot-al-servidor)
10. [Permisos del bot](#10-permisos-del-bot)
11. [Preparar el servidor y obtener los IDs](#11-preparar-el-servidor-y-obtener-los-ids)
12. [Crear el archivo .env](#12-crear-el-archivo-env)
13. [Registrar los slash commands](#13-registrar-los-slash-commands)
14. [Ejecutar en desarrollo](#14-ejecutar-en-desarrollo)
15. [Compilar TypeScript](#15-compilar-typescript)
16. [Ejecutar en producción](#16-ejecutar-en-producción)
17. [Usar /setup-tickets](#17-usar-setup-tickets)
18. [Comandos disponibles](#18-comandos-disponibles)
19. [Cómo funciona por dentro](#19-cómo-funciona-por-dentro)
20. [Casos especiales](#20-casos-especiales)
21. [Base de datos y copias de seguridad](#21-base-de-datos-y-copias-de-seguridad)
22. [Estructura del proyecto](#22-estructura-del-proyecto)
23. [Solución de problemas](#23-solución-de-problemas)

---

## 1. Qué hace el bot

1. Un administrador ejecuta `/setup-tickets` y el bot publica en el canal **#tickets-de-ayuda** un panel con el botón **🎫 Abrir ticket**.
2. Cuando un cliente presiona el botón:
   - Si ya tiene un ticket abierto, el bot le responde (solo a él): `❌ Ya tenés un ticket abierto: #ticket-0042-valentina`.
   - Si no, el bot genera un número **único y correlativo** (`#0001`, `#0002`, …) que **nunca se reinicia** ni se reutiliza.
3. El bot elige **un** agente con el rol **Atención al Cliente**:
   - ignora bots y al propio cliente,
   - prioriza a los agentes **conectados** (si activás el intent de presencia),
   - reparte de forma **equilibrada**: el agente con menos tickets abiertos y, si empatan, el que hace más tiempo que no recibe uno (round-robin).
4. Crea un canal privado, por ejemplo `ticket-0042-valentina`, dentro de la categoría de tickets. **Solo lo ven el cliente, el agente asignado y el bot** (y los administradores del servidor, porque Discord no permite ocultarles canales). El resto del equipo **no** ve el ticket.
5. Envía un mensaje de bienvenida que menciona al cliente y al agente, con el botón **🔒 Cerrar ticket**.
6. Si no hay agentes disponibles, el ticket se crea igual y queda **en espera**: se asigna solo apenas un agente se libera o se conecta, o un agente puede tomarlo con `/ticket-tomar`.
7. Al cerrar (solo el cliente o el agente asignado, con confirmación), se guarda todo en SQLite y el canal se elimina a los pocos segundos.

---

## 2. Requisitos

- **Node.js 22.12 o superior** (recomendado: **Node.js 24 LTS**).
- Una cuenta de Discord con permiso de **Administrador** en el servidor donde vas a usar el bot.
- Una terminal (en Windows: *PowerShell* o *Símbolo del sistema*; en macOS/Linux: *Terminal*).

No hace falta instalar SQLite: viene incluido en la dependencia `better-sqlite3`.

---

## 3. Instalar Node.js

### Windows y macOS

1. Entrá a <https://nodejs.org>.
2. Descargá la versión **LTS** (por ejemplo, 24.x) y ejecutá el instalador con las opciones por defecto.
3. Cerrá y volvé a abrir la terminal.

### Linux (con nvm)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Cerrá y volvé a abrir la terminal, y después:

```bash
nvm install 24
```

### Verificar la instalación

```bash
node -v
```

```bash
npm -v
```

`node -v` debe mostrar `v22.12.0` o superior (por ejemplo `v24.21.0`).

---

## 4. Instalar las dependencias

Abrí una terminal **dentro de la carpeta del proyecto** (la que contiene `package.json`). Por ejemplo:

```bash
cd "ruta/a/la/carpeta/bot ticket"
```

Instalá las dependencias:

```bash
npm install
```

Esto crea la carpeta `node_modules`. Solo hace falta repetirlo si cambia `package.json` o si cambiás de versión de Node.js.

---

## 5. Crear la aplicación en el Developer Portal

1. Entrá a <https://discord.com/developers/applications> e iniciá sesión.
2. Presioná **New Application**, escribí un nombre (por ejemplo *Soporte*) y aceptá.
3. En **General Information** vas a ver el **Application ID**: ese es tu `CLIENT_ID`. Copialo, lo vas a necesitar.

---

## 6. Crear el bot

1. En el menú izquierdo entrá a **Bot**.
2. Elegí el nombre y la foto del bot.
3. Recomendado: desactivá **Public Bot** para que solo vos puedas invitarlo a servidores.

---

## 7. Obtener el token

1. En la sección **Bot**, presioná **Reset Token** y confirmá.
2. Copiá el token: ese es tu `DISCORD_TOKEN`.

> ⚠️ El token es la contraseña del bot. **No lo compartas, no lo subas a GitHub y no lo pegues en el código.** Va únicamente en el archivo `.env` (que ya está excluido de git en `.gitignore`). Si se filtra, volvé a presionar **Reset Token**.

---

## 8. Activar los intents

En **Bot → Privileged Gateway Intents**:

| Intent | ¿Activar? | Para qué lo usa el bot |
|---|---|---|
| **Server Members Intent** | ✅ **Obligatorio** | Saber quién tiene el rol de Atención al Cliente y detectar cuando un cliente o agente abandona el servidor. |
| **Presence Intent** | ✅ Si `ENABLE_PRESENCE_INTENT=true` | Saber qué agentes están conectados para darles prioridad. Si no lo querés, poné `ENABLE_PRESENCE_INTENT=false`. |
| **Message Content Intent** | ❌ No hace falta | El bot no lee el contenido de los mensajes. |

Además, el bot usa el intent no privilegiado **Guilds** (servidor, canales, roles e interacciones), que no requiere activarse.

Presioná **Save Changes**.

---

## 9. Invitar el bot al servidor

Opción A — enlace directo (reemplazá `TU_CLIENT_ID` por tu Application ID):

```
https://discord.com/oauth2/authorize?client_id=TU_CLIENT_ID&permissions=268561424&scope=bot+applications.commands
```

Opción B — desde el portal:

1. Entrá a **OAuth2 → URL Generator**.
2. En **Scopes** marcá **`bot`** y **`applications.commands`**.
3. En **Bot Permissions** marcá los permisos de la [sección 10](#10-permisos-del-bot).
4. Copiá la URL generada, abrila en el navegador, elegí tu servidor y autorizá.

> Si el bot arranca y detecta permisos faltantes, también muestra en la consola el enlace de invitación correcto.

---

## 10. Permisos del bot

El bot **no necesita Administrador**. Necesita exactamente estos permisos (entero `268561424`):

| Permiso (portal en inglés) | En Discord en español | Por qué |
|---|---|---|
| View Channels | Ver canales | Ver el canal del panel, la categoría y los tickets. |
| Manage Channels | Gestionar canales | Crear y eliminar los canales de tickets. |
| Manage Roles | Gestionar roles | Editar los permisos de un canal ya creado: sumar al agente cuando un ticket en espera es asignado y quitar a un agente que dejó el servidor. **No** se usa para dar ni quitar roles. |
| Send Messages | Enviar mensajes | Publicar el panel y los mensajes de los tickets. |
| Embed Links | Insertar enlaces | Enviar los mensajes con formato (embeds). |
| Attach Files | Adjuntar archivos | Discord solo deja otorgar en un canal permisos que el bot tiene: lo necesita para que cliente y agente puedan adjuntar archivos. |
| Read Message History | Leer el historial de mensajes | Encontrar el panel existente para no duplicarlo. |
| Manage Messages | Gestionar mensajes | Mismo motivo que Attach Files: permite que el agente asignado pueda moderar mensajes dentro de su ticket. |

---

## 11. Preparar el servidor y obtener los IDs

### 11.1 Activar el Modo desarrollador

En Discord: **Ajustes de usuario (⚙️) → Avanzado → Modo desarrollador → Activado**. Esto agrega la opción **Copiar ID** al hacer clic derecho.

### 11.2 Crear lo necesario en el servidor

1. **Canal del panel**: un canal de texto llamado `tickets-de-ayuda`. Recomendado: que los miembros puedan *verlo* pero no *enviar mensajes* (así solo queda el panel).
2. **Categoría de tickets**: por ejemplo `TICKETS`. Recomendado: que `@everyone` **no** tenga *Ver canales* en la categoría. Si la hacés privada, agregá al bot (o a su rol) en los permisos de la categoría con: *Ver canales, Gestionar canales, Gestionar permisos, Enviar mensajes, Insertar enlaces, Adjuntar archivos, Leer el historial de mensajes y Gestionar mensajes*.
3. **Rol `Atención al Cliente`**: asignáselo a los agentes. **No** le des permiso de *Administrador* (los administradores ven todos los canales, incluidos todos los tickets).

### 11.3 Copiar cada ID

| Variable | Cómo obtenerla |
|---|---|
| `CLIENT_ID` | Developer Portal → tu aplicación → **General Information** → **Application ID**. |
| `GUILD_ID` | Clic derecho sobre el **ícono del servidor** → **Copiar ID del servidor**. |
| `TICKET_CHANNEL_ID` | Clic derecho sobre **#tickets-de-ayuda** → **Copiar ID del canal**. |
| `TICKETS_CATEGORY_ID` | Clic derecho sobre el **nombre de la categoría** → **Copiar ID de la categoría**. |
| `CUSTOMER_SUPPORT_ROLE_ID` | **Ajustes del servidor → Roles** → clic derecho sobre **Atención al Cliente** → **Copiar ID del rol**. (También podés hacer clic en el rol en el perfil de un miembro.) |

Los IDs son números largos, por ejemplo `123456789012345678`.

---

## 12. Crear el archivo .env

En la carpeta del proyecto, copiá el archivo de ejemplo:

macOS / Linux:

```bash
cp .env.example .env
```

Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

Windows (Símbolo del sistema):

```bat
copy .env.example .env
```

Abrí `.env` con un editor de texto y completá los valores (sin comillas ni espacios):

```env
DISCORD_TOKEN=el_token_del_paso_7
CLIENT_ID=123456789012345678
GUILD_ID=123456789012345678
TICKET_CHANNEL_ID=123456789012345678
TICKETS_CATEGORY_ID=123456789012345678
CUSTOMER_SUPPORT_ROLE_ID=123456789012345678

ENABLE_PRESENCE_INTENT=true
MAX_TICKETS_PER_AGENT=0
TICKET_CLOSE_DELAY_SECONDS=5
DATABASE_PATH=./data/tickets.sqlite
```

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DISCORD_TOKEN` | Sí | Token del bot. |
| `CLIENT_ID` | Sí | ID de la aplicación. |
| `GUILD_ID` | Sí | ID del servidor. |
| `TICKET_CHANNEL_ID` | Sí | Canal donde se publica el panel. |
| `TICKETS_CATEGORY_ID` | Sí | Categoría donde se crean los tickets. |
| `CUSTOMER_SUPPORT_ROLE_ID` | Sí | Rol de los agentes. |
| `ENABLE_PRESENCE_INTENT` | No (por defecto `false`) | `true` = prioriza agentes conectados y solo asigna a quienes están en línea, ausentes o en *No molestar* (en ese orden). Requiere activar *Presence Intent*. `false` = cualquier miembro del rol puede recibir tickets. |
| `MAX_TICKETS_PER_AGENT` | No (por defecto `0`) | Tickets abiertos simultáneos por agente. `0` = sin límite. Si todos llegan al límite, los nuevos quedan en espera. |
| `TICKET_CLOSE_DELAY_SECONDS` | No (por defecto `5`) | Segundos antes de eliminar el canal de un ticket cerrado (1 a 60). |
| `DATABASE_PATH` | No | Ruta del archivo SQLite. Por defecto `./data/tickets.sqlite`. |

Al arrancar, el bot **valida todas las variables** y, si algo está mal, muestra la lista completa de problemas y no inicia.

---

## 13. Registrar los slash commands

Con el bot ya invitado al servidor y el `.env` completo:

```bash
npm run deploy-commands
```

Deberías ver:

```
[DEPLOY] ✅ Comandos registrados: /setup-tickets, /ticket-info, /ticket-tomar, /ticket-cerrar
```

Los comandos se registran en tu servidor y aparecen al instante. Solo hace falta repetirlo si se modifican los comandos.

---

## 14. Ejecutar en desarrollo

```bash
npm run dev
```

Ejecuta el código TypeScript directamente y **se reinicia solo** cada vez que guardás un cambio. Para detenerlo: `Ctrl + C`.

Al iniciar correctamente vas a ver algo así:

```
[DB] Base de datos SQLite abierta en .../data/tickets.sqlite
[READY] Bot conectado como Soporte#1234
[TEAM] Miembros sincronizados: 152. Agentes de Atención al Cliente: 4.
[RECOVERY] Revisión de tickets completa.
[READY] ✅ Sistema de tickets listo.
```

---

## 15. Compilar TypeScript

Verificar tipos (sin generar archivos):

```bash
npm run typecheck
```

Compilar a JavaScript (genera la carpeta `dist/`):

```bash
npm run build
```

---

## 16. Ejecutar en producción

Compilá y arrancá:

```bash
npm run build
```

```bash
npm start
```

Si cambiaste comandos y querés registrarlos desde la versión compilada:

```bash
npm run deploy-commands:prod
```

### Mantenerlo siempre encendido con PM2 (recomendado)

PM2 reinicia el bot si se cae y lo vuelve a iniciar cuando se reinicia la computadora/servidor.

```bash
npm install -g pm2
```

Desde la carpeta del proyecto:

```bash
pm2 start dist/index.js --name bot-tickets
```

```bash
pm2 save
```

```bash
pm2 startup
```

(`pm2 startup` muestra un comando que tenés que copiar y ejecutar una vez para que PM2 arranque con el sistema.)

Comandos útiles:

```bash
pm2 logs bot-tickets
```

```bash
pm2 restart bot-tickets
```

```bash
pm2 stop bot-tickets
```

Para actualizar el bot: detenelo, reemplazá los archivos, ejecutá `npm install` y `npm run build`, y volvé a iniciarlo con `pm2 restart bot-tickets`.

---

## 17. Usar /setup-tickets

1. Con el bot encendido, escribí `/setup-tickets` en cualquier canal del servidor (requiere permiso de **Administrador**).
2. El bot publica el panel **🎫 Centro de ayuda** con el botón **🎫 Abrir ticket** en el canal de `TICKET_CHANNEL_ID`.
3. Si el panel ya existe, **lo actualiza en lugar de duplicarlo** (lo busca por la base de datos y, si no lo encuentra, entre los últimos mensajes del canal). Si cambiaste `TICKET_CHANNEL_ID`, borra el panel del canal anterior.
4. La respuesta (solo visible para vos) también avisa si detecta problemas de configuración: permisos faltantes, categoría o rol inexistentes, rol sin miembros, etc.

Listo: tus clientes ya pueden abrir tickets. 🎫

---

## 18. Comandos disponibles

| Comando | Quién puede usarlo | Qué hace |
|---|---|---|
| `/setup-tickets` | Administradores | Publica o actualiza el panel de tickets. |
| `/ticket-info` | Cliente, agente asignado o administradores, **dentro de un ticket** | Muestra número, cliente, agente, fecha de creación y estado. |
| `/ticket-tomar [numero]` | Miembros con el rol Atención al Cliente | Toma un ticket **en espera**. Sin número toma el más antiguo. No permite tomar tickets ya asignados a otro agente ni el propio. |
| `/ticket-cerrar` | Cliente o agente asignado, **dentro de su ticket** | Igual que el botón 🔒 (pide confirmación). Útil si se borró el mensaje inicial. |

Todas las respuestas de error son **privadas** (ephemeral): solo las ve quien ejecutó la acción.

---

## 19. Cómo funciona por dentro

### Número de ticket

Se guarda en la tabla `counters` de SQLite. Cada ticket nuevo incrementa el contador **dentro de una transacción**, junto con la creación del registro. Si el bot se reinicia después del ticket `#0047`, el siguiente es `#0048`. Aunque alguien edite la tabla a mano, el contador nunca baja de un número ya usado. Los números de tickets cerrados (o cuya creación falló) **no se reutilizan**.

### Protección contra doble clic

- La reserva del número y el alta del ticket son **una sola transacción** de SQLite.
- Un **índice único parcial** en la base de datos impide que un usuario tenga más de un ticket `open`/`waiting` en el servidor, aunque hubiera dos procesos usando la misma base.
- Resultado: dos clics simultáneos crean **un** ticket; el segundo recibe `❌ Ya tenés un ticket abierto`.

### Asignación de agentes

Orden de prioridad para elegir agente:

1. Presencia (solo con `ENABLE_PRESENCE_INTENT=true`): en línea → ausente → no molestar. Los desconectados no reciben tickets.
2. Menos tickets abiertos en este momento.
3. El que hace más tiempo que no recibe un ticket (round-robin).

Respeta `MAX_TICKETS_PER_AGENT`. La asignación en la base es atómica: dos tickets simultáneos no pueden superar el límite.

### Tickets en espera

Si no hay agentes disponibles, el ticket se crea con su canal privado (solo cliente + bot) y el mensaje `⏳ Actualmente no hay un agente disponible...`. Se asigna:

- automáticamente cuando un agente cierra un ticket y queda libre,
- automáticamente cada 60 segundos si aparece un agente disponible (se conecta o recibe el rol),
- manualmente con `/ticket-tomar` (verifica el rol y usa una actualización condicional: si dos agentes lo intentan a la vez, solo uno lo consigue).

Al asignarse, el bot suma al agente al canal y avisa mencionando a ambos.

### Botones persistentes

Todos los botones se procesan desde el evento global `interactionCreate` usando `customId` fijos (`ticket:open`, `ticket:close`, `ticket:close:confirm`, `ticket:close:cancel`). No se usan *collectors* temporales, por eso **los botones siguen funcionando después de reiniciar el bot**. El ticket se identifica por el canal donde se presionó el botón, consultando SQLite.

### Cierre

1. El cliente o el agente asignado presiona **🔒 Cerrar ticket** (o usa `/ticket-cerrar`).
2. El bot pregunta, en privado, `¿Seguro que querés cerrar este ticket?` con **✅ Sí, cerrar** / **❌ Cancelar**.
3. Al confirmar: marca el ticket como `closed` en SQLite (guarda fecha de cierre, quién lo cerró y el motivo), envía `🔒 El ticket #0042 fue cerrado por @usuario.` y programa el borrado del canal a los pocos segundos **sin bloquear** al bot.
4. El agente queda libre y, si hay tickets en espera, se le asigna el siguiente.
5. El cliente puede abrir un ticket nuevo cuando quiera.

### Recuperación al reiniciar

Cada vez que el bot arranca revisa los tickets abiertos y corrige lo que pasó mientras estaba apagado: cierra los tickets cuyo canal fue borrado o cuyo cliente se fue, devuelve a la cola los tickets de agentes que se fueron, limpia creaciones interrumpidas y elimina canales de tickets ya cerrados que no llegaron a borrarse.

---

## 20. Casos especiales

| Situación | Qué hace el bot |
|---|---|
| El usuario hace doble clic en **Abrir ticket** | Crea un solo ticket (transacción + índice único en SQLite). |
| El cliente abandona el servidor | Cierra su ticket automáticamente (`customer_left`), avisa en el canal y lo elimina. |
| El agente asignado abandona el servidor | Sus tickets vuelven a la cola (se avisa al cliente) y se reasignan a otro agente disponible. |
| Se elimina manualmente un canal de ticket | El ticket se marca como cerrado (`channel_deleted`) y el agente queda libre. |
| Se elimina el rol de Atención al Cliente | Se registra un error en consola; los tickets nuevos se crean igual y quedan en espera. Los agentes ya asignados conservan sus tickets. |
| Se elimina la categoría de tickets | Se registra un error; no se abren tickets nuevos (el usuario recibe un aviso privado) y no se consume ningún número. Los tickets existentes siguen funcionando. |
| El bot no tiene permisos suficientes | Se detecta antes de crear el canal, se informa qué permiso falta (en consola y en `/setup-tickets`) y el usuario recibe un aviso privado. |
| El canal del panel ya no existe | `/setup-tickets` lo informa y se registra un error en consola. |
| Un usuario intenta cerrar un ticket ajeno | Mensaje privado: `❌ Solo el cliente que abrió el ticket o el agente asignado pueden cerrarlo.` |
| Un agente intenta acceder a un ticket que no es suyo | No ve el canal (permisos de Discord), no puede cerrarlo y `/ticket-tomar` rechaza tickets ya asignados. |
| Discord devuelve un error al crear el canal | El ticket queda registrado como cerrado (`creation_failed`), se borra el canal a medio crear si existía, el agente queda libre y el usuario puede reintentar. |
| El bot se reinicia con tickets abiertos | Todo sigue en SQLite; los botones siguen funcionando y la recuperación corrige inconsistencias. |
| La categoría llega a 50 canales (límite de Discord) | El usuario recibe un aviso; conviene cerrar tickets viejos o crear otra categoría y actualizar `TICKETS_CATEGORY_ID`. |

> **Importante:** no uses la opción **"Sincronizar permisos"** de Discord sobre un canal de ticket: reemplazaría los permisos privados por los de la categoría.

---

## 21. Base de datos y copias de seguridad

- Archivo: `data/tickets.sqlite` (o el de `DATABASE_PATH`). Se crea solo, junto con sus tablas, la primera vez.
- Tablas:
  - `tickets`: `id`, `ticket_number` (único), `guild_id`, `channel_id`, `customer_id`, `moderator_id`, `status` (`open` / `waiting` / `closed`), `created_at`, `assigned_at`, `closed_at`, `closed_by`, `close_reason`.
  - `counters`: contador persistente de tickets.
  - `ticket_panels`: mensaje del panel publicado (para no duplicarlo).
- Las fechas se guardan en formato ISO 8601 (UTC).
- `closed_by` vacío significa que el ticket se cerró solo porque alguien borró el canal; si lo cerró el sistema por otro motivo, contiene el ID del bot.
- **No borres este archivo**: perderías el historial y el contador.
- **Copia de seguridad**: detené el bot y copiá el archivo `tickets.sqlite` (y, si existen, `tickets.sqlite-wal` y `tickets.sqlite-shm`).

---

## 22. Estructura del proyecto

```
├── src/
│   ├── index.ts                 Punto de entrada: config, SQLite, cliente, eventos y apagado ordenado
│   ├── client.ts                Cliente de Discord (intents y partials)
│   ├── deploy-commands.ts       Registro de slash commands
│   ├── commands/                /setup-tickets, /ticket-info, /ticket-tomar, /ticket-cerrar
│   ├── events/                  ready, interactionCreate, guildMemberRemove, channelDelete, roleDelete, errores
│   ├── interactions/            Router de interacciones y botones (abrir, cerrar, confirmar, cancelar)
│   ├── services/                Lógica de negocio: tickets, asignación, canales, panel, recuperación
│   ├── database/                Conexión, migraciones y repositorios SQLite
│   ├── utils/                   Logger, embeds, botones, formatos, permisos, errores de Discord
│   ├── config/                  Variables de entorno (validadas), constantes y textos
│   └── types/                   Tipos e interfaces (Ticket, comandos, botones, eventos, contexto)
├── data/                        Base de datos SQLite (se crea sola, no se sube a git)
├── dist/                        Código compilado (npm run build)
├── .env.example                 Plantilla de configuración
├── package.json
└── tsconfig.json
```

Separación de responsabilidades: `database/` solo habla con SQLite, `services/` contiene las reglas del negocio y las operaciones de Discord, y `commands/` + `interactions/` solo traducen interacciones a llamadas de servicio y respuestas al usuario.

---

## 23. Solución de problemas

**"Discord rechazó los intents del bot" / "Used disallowed intents"**
Activá *Server Members Intent* (y *Presence Intent* si `ENABLE_PRESENCE_INTENT=true`) en el Developer Portal → Bot. O poné `ENABLE_PRESENCE_INTENT=false`.

**"El token del bot es inválido"**
Generá un token nuevo (Bot → Reset Token) y pegalo completo en `DISCORD_TOKEN`.

**Los comandos no aparecen**
Ejecutá `npm run deploy-commands`. Si responde *Missing Access*, el bot no está en el servidor `GUILD_ID` o fue invitado sin el scope `applications.commands`: volvé a invitarlo con el enlace de la [sección 9](#9-invitar-el-bot-al-servidor). En Discord, probá con `Ctrl + R` para recargar.

**"No es posible abrir tickets en este momento"**
Mirá la consola o ejecutá `/setup-tickets`: indica qué falta (categoría inexistente, permisos del bot en la categoría, etc.).

**Un agente ve tickets que no le corresponden**
Seguramente tiene permiso de **Administrador** (Discord siempre muestra todo a los administradores) o alguien usó "Sincronizar permisos" en el canal.

**Los tickets siempre quedan en espera**
Verificá que el rol tenga miembros. Con `ENABLE_PRESENCE_INTENT=true` solo se asignan agentes conectados (en línea, ausente o no molestar); los que aparecen *invisibles* o desconectados no reciben tickets, pero pueden usar `/ticket-tomar`.

**Error al instalar `better-sqlite3`**
Usá Node.js 22.12 o superior (idealmente 24 LTS). En sistemas poco comunes puede necesitar herramientas de compilación: en Windows, *"Tools for Native Modules"* del instalador de Node.js; en Linux, `build-essential` y `python3`. Si cambiaste de versión de Node.js, ejecutá `npm rebuild better-sqlite3`.
