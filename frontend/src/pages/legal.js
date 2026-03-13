// src/pages/legal.js — Terms of Service & Privacy Policy

import { router } from "../lib/router.js";

export function renderLegal(type) {
  const page = ensurePage("page-legal");
  const isTerms = type === "terms";

  page.innerHTML = `
    <div class="legal-content z1">
      <div style="margin-bottom:2rem">
        <button class="btn btn-ghost btn-sm" onclick="router.navigate('home')">← Inicio</button>
      </div>
      ${isTerms ? renderTerms() : renderPrivacy()}
      <div style="margin-top:3rem;padding-top:1rem;border-top:1px solid var(--border);font-size:0.78rem;color:var(--text3)">
        <p>Última actualización: Marzo 2026</p>
        <p style="margin-top:0.5rem">
          Contacto: <a href="mailto:ghaviano@itb.edu.ec">ghaviano@itb.edu.ec</a> ·
          GitHub: <a href="https://github.com/magoflaco" target="_blank" rel="noopener">@magoflaco</a> ·
          WhatsApp: <a href="https://wa.me/593983941273" target="_blank" rel="noopener">+593 983 941 273</a>
        </p>
        <p style="margin-top:0.25rem">© ${new Date().getFullYear()} Wicca Inc. Todos los derechos reservados.</p>
      </div>
    </div>`;
}

function renderTerms() {
  return `
    <h1>Términos de Servicio</h1>
    <p style="color:var(--text3);font-size:0.82rem">Última actualización: Marzo 2026</p>

    <h2>1. Aceptación de los Términos</h2>
    <p>Al acceder y utilizar PyContest ("la Plataforma"), operada por Wicca Inc., usted acepta cumplir con estos Términos de Servicio y todas las leyes y regulaciones aplicables. Si no está de acuerdo con alguno de estos términos, no debe utilizar la Plataforma.</p>

    <h2>2. Descripción del Servicio</h2>
    <p>PyContest es una plataforma educativa de concursos de programación en Python, donde las soluciones son evaluadas mediante inteligencia artificial. El servicio permite a los usuarios:</p>
    <ul>
      <li>Participar en concursos de programación</li>
      <li>Organizar y gestionar concursos</li>
      <li>Recibir evaluaciones automatizadas de código mediante IA</li>
      <li>Consultar rankings y estadísticas de rendimiento</li>
    </ul>

    <h2>3. Registro y Cuentas</h2>
    <p>Para utilizar ciertas funciones de la Plataforma, debe crear una cuenta proporcionando información precisa. Usted es responsable de mantener la confidencialidad de su contraseña y de todas las actividades que ocurran bajo su cuenta.</p>
    <p>Nos reservamos el derecho de suspender o eliminar cuentas que violen estos términos o que muestren comportamiento inadecuado.</p>

    <h2>4. Uso Aceptable</h2>
    <p>Al usar la Plataforma, usted se compromete a:</p>
    <ul>
      <li>No copiar, plagiar o compartir soluciones durante concursos activos</li>
      <li>No intentar manipular o engañar al sistema de evaluación</li>
      <li>No utilizar bots, scripts automatizados o herramientas para obtener ventaja injusta</li>
      <li>No transmitir contenido malicioso, ofensivo o ilegal</li>
      <li>No interferir con el funcionamiento de la Plataforma</li>
      <li>No recopilar datos de otros usuarios sin consentimiento</li>
    </ul>

    <h2>5. Contenido del Usuario</h2>
    <p>El código que envía a la Plataforma permanece como su propiedad intelectual. Sin embargo, usted otorga a Wicca Inc. una licencia no exclusiva para almacenar, procesar y evaluar su código con fines del servicio.</p>
    <p>Los organizadores de concursos son responsables del contenido de los problemas que crean y de garantizar que no infringen derechos de terceros.</p>

    <h2>6. Evaluación por IA</h2>
    <p>Las evaluaciones son generadas por modelos de inteligencia artificial y pueden contener errores o imprecisiones. Wicca Inc. no garantiza la exactitud absoluta de las evaluaciones. Los organizadores tienen la capacidad de corregir calificaciones manualmente.</p>

    <h2>7. Disponibilidad del Servicio</h2>
    <p>Nos esforzamos por mantener la Plataforma disponible de manera continua, pero no garantizamos un tiempo de actividad del 100%. El servicio puede estar sujeto a interrupciones por mantenimiento, actualizaciones o circunstancias fuera de nuestro control.</p>

    <h2>8. Limitación de Responsabilidad</h2>
    <p>Wicca Inc. no será responsable por daños indirectos, incidentales o consecuentes derivados del uso de la Plataforma, incluyendo pero no limitado a pérdida de datos, interrupción del servicio o evaluaciones incorrectas.</p>

    <h2>9. Modificaciones</h2>
    <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios serán efectivos al publicarse en la Plataforma. El uso continuado del servicio constituye la aceptación de los términos modificados.</p>

    <h2>10. Contacto</h2>
    <p>Para consultas sobre estos términos, puede contactarnos en:</p>
    <ul>
      <li>Email: <a href="mailto:ghaviano@itb.edu.ec">ghaviano@itb.edu.ec</a></li>
      <li>GitHub: <a href="https://github.com/magoflaco" target="_blank" rel="noopener">@magoflaco</a></li>
      <li>WhatsApp: <a href="https://wa.me/593983941273" target="_blank" rel="noopener">+593 983 941 273</a></li>
    </ul>

    <h2>11. Ley Aplicable</h2>
    <p>Estos términos se rigen por las leyes de la República del Ecuador. Cualquier disputa será sometida a la jurisdicción de los tribunales competentes de Guayaquil, Ecuador.</p>`;
}

function renderPrivacy() {
  return `
    <h1>Política de Privacidad</h1>
    <p style="color:var(--text3);font-size:0.82rem">Última actualización: Marzo 2026</p>

    <h2>1. Información que Recopilamos</h2>

    <h3>1.1 Información proporcionada por el usuario</h3>
    <ul>
      <li><strong>Datos de registro:</strong> nombre, nombre de usuario, email y contraseña (almacenada de forma encriptada)</li>
      <li><strong>Perfil:</strong> foto de perfil, preferencias de configuración</li>
      <li><strong>Contenido:</strong> código fuente enviado como soluciones a problemas</li>
    </ul>

    <h3>1.2 Información recopilada automáticamente</h3>
    <ul>
      <li>Datos de uso (páginas visitadas, funciones utilizadas)</li>
      <li>Dirección IP y datos básicos del navegador</li>
      <li>Tiempos de resolución y estadísticas de rendimiento</li>
    </ul>

    <h2>2. Uso de la Información</h2>
    <p>Utilizamos la información recopilada para:</p>
    <ul>
      <li>Operar y mantener la Plataforma</li>
      <li>Evaluar código mediante IA y generar retroalimentación</li>
      <li>Generar rankings y estadísticas de concursos</li>
      <li>Comunicaciones relacionadas con el servicio (verificación de email, invitaciones)</li>
      <li>Mejorar la experiencia del usuario y la calidad del servicio</li>
    </ul>

    <h2>3. Procesamiento de Código por IA</h2>
    <p>El código que envía es procesado por modelos de inteligencia artificial de terceros (Alibaba Cloud / ModelStudio) para generar evaluaciones. Este procesamiento se realiza de forma automatizada y el código no es utilizado para entrenar modelos de IA.</p>

    <h2>4. Compartición de Datos</h2>
    <p>No vendemos, alquilamos ni compartimos su información personal con terceros, excepto en las siguientes situaciones:</p>
    <ul>
      <li>Proveedores de servicios que ayudan a operar la Plataforma (procesamiento de IA, envío de emails)</li>
      <li>Cumplimiento de obligaciones legales</li>
      <li>Protección de los derechos de Wicca Inc.</li>
    </ul>
    <p>Los organizadores de concursos pueden ver las soluciones y calificaciones de los participantes en sus concursos.</p>

    <h2>5. Serv de Email</h2>
    <p>Utilizamos Resend como servicio de email transaccional para enviar códigos de verificación e invitaciones. Los emails son enviados exclusivamente para fines operativos del servicio.</p>

    <h2>6. Seguridad</h2>
    <p>Implementamos medidas de seguridad para proteger su información, incluyendo:</p>
    <ul>
      <li>Encriptación de contraseñas mediante bcrypt</li>
      <li>Autenticación basada en JWT</li>
      <li>Límites de velocidad en endpoints sensibles</li>
      <li>Verificación de email mediante OTP</li>
    </ul>

    <h2>7. Retención de Datos</h2>
    <p>Conservamos sus datos mientras su cuenta esté activa. Si elimina su cuenta, sus datos personales serán eliminados de nuestros sistemas, incluyendo envíos y membresías a concursos.</p>

    <h2>8. Sus Derechos</h2>
    <p>Usted tiene derecho a:</p>
    <ul>
      <li>Acceder a su información personal</li>
      <li>Corregir datos inexactos</li>
      <li>Eliminar su cuenta y datos asociados</li>
      <li>Exportar sus datos (envíos y estadísticas)</li>
    </ul>

    <h2>9. Cookies</h2>
    <p>La Plataforma utiliza localStorage para almacenar su sesión y preferencias de tema. No utilizamos cookies de rastreo ni servicios de análisis de terceros.</p>

    <h2>10. Menores de Edad</h2>
    <p>La Plataforma está diseñada para uso educativo. Los menores de 13 años deben contar con autorización de un padre o tutor para utilizar el servicio.</p>

    <h2>11. Contacto</h2>
    <p>Para consultas sobre privacidad, puede contactarnos en:</p>
    <ul>
      <li>Email: <a href="mailto:ghaviano@itb.edu.ec">ghaviano@itb.edu.ec</a></li>
      <li>GitHub: <a href="https://github.com/magoflaco" target="_blank" rel="noopener">@magoflaco</a></li>
      <li>WhatsApp: <a href="https://wa.me/593983941273" target="_blank" rel="noopener">+593 983 941 273</a></li>
    </ul>`;
}

function ensurePage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  let page = document.getElementById(id);
  if (!page) {
    page = document.createElement("div");
    page.id = id;
    page.className = "page";
    document.getElementById("app").appendChild(page);
  }
  page.classList.add("active");
  return page;
}
