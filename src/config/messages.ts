/** Textos fijos que ve el usuario. Los mensajes con datos variables se arman donde se usan. */
export const Messages = {
  waitingForAgent:
    '⏳ Actualmente no hay un agente disponible. Tu ticket quedó en espera y será atendido en cuanto sea posible.',
  waitingAgentLabel: '⏳ Esperando disponibilidad',
  closeConfirmation: '¿Seguro que querés cerrar este ticket?',
  closeCancelled: '✅ Cancelado. El ticket sigue abierto.',
  closing: '🔒 Cerrando el ticket...',
  notATicketChannel: '❌ Este comando solo funciona dentro de un canal de ticket.',
  ticketAlreadyClosed: '🔒 Este ticket ya está cerrado.',
  notAllowedToClose: '❌ Solo el cliente que abrió el ticket o el agente asignado pueden cerrarlo.',
  notAllowedToView: '❌ No tenés acceso a la información de este ticket.',
  adminOnly: '❌ Solo los administradores pueden usar este comando.',
  supportOnly: '❌ Solo los miembros del equipo de Atención al Cliente pueden tomar tickets.',
  wrongGuild: '❌ Este bot solo funciona dentro del servidor configurado.',
  unknownAction: '❌ Esta acción ya no es válida.',
  unexpectedError: '❌ Ocurrió un error inesperado. Intentá de nuevo en unos segundos.',
} as const;

/** Ayudas que se muestran en la consola cuando el bot no puede conectarse. */
export const ConsoleHelp = {
  invalidToken:
    'El token del bot es inválido. Generá uno nuevo en el Developer Portal (Bot → Reset Token) y actualizá DISCORD_TOKEN en .env.',
  disallowedIntents:
    'Discord rechazó los intents del bot. En el Developer Portal → Bot → "Privileged Gateway Intents" activá ' +
    '"Server Members Intent" y, si ENABLE_PRESENCE_INTENT=true, también "Presence Intent". ' +
    'Otra opción: poné ENABLE_PRESENCE_INTENT=false en .env.',
} as const;
