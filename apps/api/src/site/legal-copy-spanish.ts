import { LegalDocument } from './legal-links';
import type { LegalText } from './legal-copy';

export const SPANISH_LEGAL_COPY: Record<LegalDocument, LegalText> = {
  [LegalDocument.Terms]: {
    title: 'Términos de uso',
    description: 'Las reglas para usar zapbip, el canal de WhatsApp para tus agentes de IA, creado por Logic Bit en Brasil.',
    summary:
      'Estos términos son el acuerdo entre tú y {tradeName} para el uso de zapbip. Al registrarte en la lista de espera o escribir a zapbip por WhatsApp, los aceptas.',
    updated: 'Última actualización: {updatedOn}',
    sections: [
      {
        heading: 'Quiénes somos',
        paragraphs: ['zapbip es un servicio de {tradeName}, nombre comercial de {legalName}, CNPJ {cnpj}. Contacto: {contactEmail}.'],
        items: [],
      },
      {
        heading: 'Qué hace zapbip',
        paragraphs: [
          'zapbip conecta los agentes de IA que elijas, como {agents} o cualquier cliente MCP, con tu propio WhatsApp a través de la plataforma oficial WhatsApp Business de Meta. Tus agentes pueden enviarte mensajes, hacerte preguntas y recibir tus respuestas. zapbip habla solo contigo y nunca escribe a tus contactos ni a nadie más.',
          'zapbip está en acceso anticipado. Las cuentas se abren por invitación desde la lista de espera, y las funciones pueden cambiar por el camino.',
        ],
        items: [],
      },
      {
        heading: 'Tu cuenta',
        paragraphs: [],
        items: [
          'Tu cuenta es tu número de WhatsApp. Inicias sesión escribiendo a zapbip; no hay contraseña.',
          'Los mensajes te llegan desde un número de zapbip. Conectar tu propio número como remitente aún no está disponible.',
          'Debes tener al menos 18 años y capacidad para celebrar un contrato.',
          'Mantén en secreto la clave de cada agente. Quien tenga una clave puede escribirte como ese agente, así que revócala de inmediato si se filtra.',
          'Eres responsable de lo que ocurra a través de tu cuenta y de tus agentes.',
        ],
      },
      {
        heading: 'Tus agentes',
        paragraphs: [
          'Tus agentes son software que tú eliges y ejecutas. zapbip entrega sus mensajes y tus respuestas, pero no escribe, revisa ni controla lo que dicen o hacen. Lo que decidas a partir de un mensaje de un agente, como responder con un botón, es decisión tuya. Los proveedores de IA que hay detrás de tus agentes tienen sus propios términos.',
        ],
        items: [],
      },
      {
        heading: 'Uso aceptable',
        paragraphs: [
          'Podemos suspender o cerrar una cuenta que incumpla estas reglas, y podemos denunciar actividades ilegales ante las autoridades.',
        ],
        items: [
          'Usa zapbip solo para hablar con tus propios agentes.',
          'No envíes spam, contenido ilegal ni contenido que infrinja las políticas de WhatsApp Business de Meta.',
          'No intentes contactar a otras personas a través de zapbip, eludir sus límites ni vulnerar el servicio u otras cuentas.',
          'No revendas zapbip ni lo sobrecargues.',
        ],
      },
      {
        heading: 'Planes y precios',
        paragraphs: [
          'El plan Gratis incluye {free} mensajes para probar zapbip, sin coste. Los planes de pago y los precios del sitio se aplican solo cuando se abra la facturación, y verás y aceptarás un precio antes de pagar nada. Te avisaremos con antelación de cualquier cambio de precio que te afecte.',
        ],
        items: [],
      },
      {
        heading: 'Disponibilidad',
        paragraphs: [
          'Nos esforzamos por mantener zapbip en funcionamiento, pero se ofrece tal cual, sin garantía de que esté siempre disponible ni de que se entregue cada mensaje. Depende de Meta, de Cloudflare y de internet. No uses zapbip para emergencias ni para nada en lo que un mensaje tardío o perdido pueda causar daño.',
        ],
        items: [],
      },
      {
        heading: 'Responsabilidad',
        paragraphs: [
          'En la medida en que lo permita la ley brasileña, {tradeName} no responde por daños indirectos, lucro cesante ni pérdidas causadas por tus agentes, por servicios de terceros o por mensajes tardíos o no entregados. Nada en estos términos limita los derechos que tienes según el Código de Defensa del Consumidor de Brasil (Ley 8.078/1990) ni según cualquier otra ley a la que no se pueda renunciar.',
        ],
        items: [],
      },
      {
        heading: 'Cierre de tu cuenta',
        paragraphs: [
          'Puedes eliminar tu cuenta en cualquier momento enviando "eliminar cuenta" a zapbip por WhatsApp. Podemos cerrar una cuenta que incumpla estos términos o poner fin al servicio con previo aviso. La política de privacidad explica qué ocurre con tus datos.',
        ],
        items: [],
      },
      {
        heading: 'Cambios en estos términos',
        paragraphs: [
          'Podemos actualizar estos términos; la fecha de arriba indica la versión vigente. Te avisaremos por WhatsApp o en este sitio antes de que entre en vigor un cambio importante. Seguir usando zapbip después significa que aceptas los nuevos términos.',
        ],
        items: [],
      },
      {
        heading: 'Ley y tribunales',
        paragraphs: [
          'Estos términos se rigen por las leyes de Brasil. Las disputas se someten a los tribunales de Brasil, salvo que la ley te permita, como consumidor, acudir a los tribunales de tu lugar de residencia. Estos términos están redactados en portugués y traducidos al español; si ambas versiones difieren, prevalece la versión en portugués.',
        ],
        items: [],
      },
      { heading: 'Contacto', paragraphs: ['Preguntas sobre estos términos: {contactEmail}.'], items: [] },
    ],
  },
  [LegalDocument.Privacy]: {
    title: 'Política de privacidad',
    description:
      'Qué recopila zapbip, por qué, durante cuánto tiempo y tus derechos según la Ley General de Protección de Datos de Brasil (LGPD).',
    summary:
      'zapbip conserva solo lo necesario para entregar mensajes entre tú y tus agentes, y elimina cada dato pasado un plazo fijo. Esta política sigue la Ley General de Protección de Datos de Brasil (Ley 13.709/2018, la LGPD).',
    updated: 'Última actualización: {updatedOn}',
    sections: [
      {
        heading: 'Quién es el responsable',
        paragraphs: [
          '{tradeName} ({legalName}, CNPJ {cnpj}) es el responsable del tratamiento de tus datos personales. Nuestro delegado de protección de datos está en {contactEmail}.',
        ],
        items: [],
      },
      {
        heading: 'Qué recopilamos',
        paragraphs: [],
        items: [
          'Lista de espera: tu correo, el idioma de la página y los datos de invitación (quién te invitó y a cuántas personas invitaste). No se guarda ninguna dirección IP con ellos.',
          'Cuenta: tu número de WhatsApp, tu idioma y la fecha en que te uniste.',
          'Agentes: el nombre de cada agente que conectas, la app en la que se ejecuta cuando la app nos lo indica, cuándo se creó y cuándo estuvo activo por última vez. La clave de cada agente se guarda solo como resumen criptográfico.',
          'Mensajes: los textos, preguntas, botones y respuestas entre tú y tus agentes, y las fotos y archivos que intercambias.',
          'App web: una cookie de sesión cuando inicias sesión en app.zapbip.com.',
          'Datos técnicos: cuando usas el sitio o el servicio, Cloudflare, nuestro proveedor de alojamiento, procesa datos de la solicitud, como tu dirección IP, para entregarlo y protegerlo.',
        ],
      },
      {
        heading: 'Para qué los usamos',
        paragraphs: ['No vendemos tus datos, no mostramos anuncios y no usamos tus mensajes para entrenar modelos de IA.'],
        items: [
          'Para prestar el servicio que pediste: entregar mensajes entre tú y tus agentes y gestionar tu cuenta (LGPD, artículo 7, V).',
          'Para gestionar la lista de espera y escribirte sobre ella (la bienvenida al registrarte, novedades sobre tu acceso y tu invitación), con el consentimiento que das al registrarte (artículo 7, I).',
          'Para mantener zapbip seguro y evitar abusos, como el captcha del formulario de la lista de espera y los límites de frecuencia (interés legítimo, artículo 7, IX).',
          'Para cumplir obligaciones legales (artículo 7, II).',
        ],
      },
      {
        heading: 'Cuánto tiempo los conservamos',
        paragraphs: ['Los registros nunca incluyen el texto de tus mensajes.'],
        items: [
          'Mensajes y preguntas que esperan por ti o por un agente: {messageDays} días.',
          'Fotos y archivos: {mediaDays} días.',
          'Sesión de la app web: hasta {sessionDays} días, o hasta que cierres sesión.',
          'Cuenta y agentes: hasta que elimines tu cuenta.',
          'Lista de espera: hasta que obtengas acceso o nos pidas eliminarte.',
        ],
      },
      {
        heading: 'Con quién los compartimos',
        paragraphs: [
          'Compartimos datos solo con los proveedores que hacen funcionar zapbip. Tus agentes reciben los mensajes que les envías; funcionan bajo tu control y bajo los términos de sus propios proveedores. También podemos revelar datos cuando la ley o un tribunal lo exijan.',
        ],
        items: [
          'Meta Platforms, a través de la plataforma oficial WhatsApp Business, que transporta cada mensaje de WhatsApp.',
          'Cloudflare, que aloja el servicio y su almacenamiento y ejecuta el captcha (Turnstile) del formulario de la lista de espera.',
          'Mintlify, que aloja la documentación en docs.zapbip.com.',
          'Resend, que envía nuestros correos, como la bienvenida a la lista de espera.',
        ],
      },
      {
        heading: 'Transferencia internacional',
        paragraphs: [
          'Meta, Cloudflare y Resend procesan datos en servidores fuera de Brasil, incluido Estados Unidos. Estas transferencias son necesarias para prestar el servicio y respetan las garantías de la LGPD (artículo 33).',
        ],
        items: [],
      },
      {
        heading: 'Cookies',
        paragraphs: [
          'El sitio establece solo dos cookies propias, para recordar tu idioma y tu tema, y la app web establece una cookie de sesión cuando inicias sesión. No hay cookies publicitarias ni de seguimiento.',
        ],
        items: [],
      },
      {
        heading: 'Tus derechos',
        paragraphs: [
          'Para eliminar tu cuenta y todo lo que contiene, envía "eliminar cuenta" a zapbip por WhatsApp. Para cualquier otra cosa, escribe a {contactEmail}; respondemos en un plazo de 15 días.',
        ],
        items: [
          'Confirmar si tratamos tus datos y acceder a ellos.',
          'Corregir datos incompletos o erróneos.',
          'Pedir que los datos innecesarios se anonimicen, bloqueen o eliminen.',
          'Pedir que tus datos se trasladen a otro proveedor.',
          'Saber con quién los compartimos.',
          'Retirar tu consentimiento en cualquier momento.',
          'Presentar una queja ante la Autoridad Nacional de Protección de Datos de Brasil (ANPD).',
        ],
      },
      {
        heading: 'Qué conservan Meta y Cloudflare',
        paragraphs: [
          'Cuando eliminas tu cuenta, Meta conserva el chat de WhatsApp en su lado y Cloudflare conserva copias de seguridad, cada uno durante su propio plazo de conservación. Elimina el chat en WhatsApp para quitarlo de tu teléfono.',
        ],
        items: [],
      },
      {
        heading: 'Seguridad',
        paragraphs: [
          'Todas las conexiones usan HTTPS. Las claves de los agentes y las sesiones de la app web se guardan solo como resúmenes criptográficos, y cada agente tiene su propia clave, que puedes revocar en cualquier momento.',
        ],
        items: [],
      },
      {
        heading: 'Menores',
        paragraphs: ['zapbip no está dirigido a menores de 18 años y no recopilamos sus datos de forma consciente.'],
        items: [],
      },
      {
        heading: 'Cambios en esta política',
        paragraphs: [
          'Podemos actualizar esta política; la fecha de arriba indica la versión vigente, y te avisaremos antes de que entre en vigor un cambio importante. Esta política está redactada en portugués y traducida al español; si ambas versiones difieren, prevalece la versión en portugués.',
        ],
        items: [],
      },
    ],
  },
};
