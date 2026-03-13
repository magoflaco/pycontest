# PyContest 🐍

Plataforma elegante y moderna para organizar y participar en concursos de programación en Python, con evaluación automática impulsada por Inteligencia Artificial (Qwen3-Coder).

## 🌟 Características

*   **Tema Elegante (Claro/Oscuro)**: Interfaz minimalista con paletas pastel, tipografías modernas y transiciones suaves.
*   **Gestión de Usuarios Completa**:
    *   Registro e inicio de sesión seguro con roles (`Participante`, `Organizador` o `Ambos`).
    *   Generador de avatares automáticos aleatorios (estilo GitHub) y subida de fotos personalizadas.
    *   Cambio de nombre de usuario, contraseña y verificación de cambios de email vía OTP seguro.
*   **Para Organizadores**:
    *   Creación de concursos (públicos o vía enlace de invitación), problemas y rankings.
    *   Panel de moderación interactivo para leer, revisar y corregir calificaciones manualmente en tiempo real.
*   **Para Participantes**:
    *   Resolución de problemas de Python directamente desde el navegador (Syntax Highlighting estilo Catppuccin Mocha).
    *   Envío de soluciones con evaluación inteligente que comprende lógica, eficiencia y resultados flexibles en milisegundos.
*   **Seguridad**:
    *   Autenticación JWT y políticas Rate Limit para prevenir abusos.

---

## 🛠️ Arquitectura Técnica

El proyecto se divide en dos módulos principales:

*   **Frontend**: Creado con **Vanilla JS**, HTML y CSS nativo. Empaquetado con **Vite**, e incluye un sistema casero de enrutamiento SPA y gestión global del estado (almacenando temas preferidos y sesiones).
*   **Backend**: Servidor robusto Node.js / Express con **Prisma** como ORM conectado a **PostgreSQL**. Utiliza el SDK de OpenAI para conectarse con **ModelStudio de Alibaba (Qwen3-Coder)** y **Resend** para la emisión de emails OTP.

---

## 🚀 Instalación y Despliegue Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/pycontest.git
cd pycontest
```

### 2. Configurar el Backend
```bash
cd backend
npm install
```
Renombra `.env.example` a `.env` y rellena con tus claves (Base de datos PostgreSQL, Secret JWT, API Key de ModelStudio y Resend).
```bash
# Sube y aplica la estructura a tu base de datos:
npx prisma db push
npx prisma generate
# Inicia el entorno de desarrollo:
npm run dev
```

### 3. Configurar el Frontend
```bash
cd ../frontend
npm install
```
Crea el archivo `.env` en base a `.env.example` referenciando la URL de tu backend local (por defecto `http://localhost:4000`).
```bash
# Inicia Vite
npm run dev
```

---

## 📸 Interfaz Visual

El proyecto cuenta con una atención meticulosa a los detalles visuales. El código se renderiza sin librerías pesadas, con parseo en el cliente en tiempo real:

<details>
<summary>Ver Imágenes de la Plataforma</summary>
(Agrega aquí tus capturas de pantalla de la carpeta `frontend/public/` o tu entorno en vivo para impresionar a tus visitantes).
</details>

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

© 2026 Wicca Inc. Todos los derechos reservados.
