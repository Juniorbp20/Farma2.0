// src/pages/tutorialsData.js

export const tutorials = [
  // Datos para los tutoriales en video
  { id: 101, title: "Bienvenida y tour general", section: "Resumen", roleAccess: [1, 2, 3], contentType: "video", videoId: "dQw4w9WgXcQ" },
  { id: 201, title: "Gestión de Inventario", section: "Inventario", roleAccess: [1, 3], contentType: "video", videoId: "wWoQ7PFSYlk" },
  { id: 302, title: "Anulación/Devolución", section: "Facturación", roleAccess: [1, 2], contentType: "video", videoId: "ESOjt2_yJrU" },
  { id: 401, title: "Gestión de Usuarios", section: "Usuarios", roleAccess: [1], contentType: "video", videoId: "foE1mO2yM04" },

  // Datos para los tutoriales en el acordeon de texto
  { id: 501, title: "Reportes y estadísticas", section: "Reportes", roleAccess: [1, 3], contentType: "text", text: "Explora reportes de ventas, stock y tendencias para la toma de decisiones." },
  { id: 402, title: "Roles y permisos", section: "Usuarios", roleAccess: [1], contentType: "text", text: "Cómo asignar roles y configurar permisos granulares en el sistema." },
  { id: 301, title: "Registrar Venta", section: "Facturación", roleAccess: [1, 2], contentType: "text", text: "Guía paso a paso para registrar una venta en el punto de venta (POS)." },
  { id: 202, title: "Registrar Lotes", section: "Inventario", roleAccess: [1, 3], contentType: "text", text: "Aprende a registrar y actualizar lotes, fechas de vencimiento y stock mínimo." },
  { id: 102, title: "Buenas prácticas de uso", section: "Resumen", roleAccess: [1, 2, 3, 4], contentType: "text", text: "Conoce recomendaciones de uso, flujos sugeridos y atajos clave de Farma2.0." },

];

