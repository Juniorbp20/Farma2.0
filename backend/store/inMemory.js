// backend/store/inMemory.js
// Fuente de datos en memoria para demo/desarrollo

const store = {
  productos: [
    { ProductoID: 1, CodigoBarra: '7501001234567', Nombre: 'Paracetamol 500mg x10', Precio: 12.5, Stock: 50, StockMinimo: 10 },
    { ProductoID: 2, CodigoBarra: '7502007654321', Nombre: 'Ibuprofeno 400mg x10', Precio: 15.9, Stock: 40, StockMinimo: 10 },
    { ProductoID: 3, CodigoBarra: '7701234567890', Nombre: 'Amoxicilina 500mg x12', Precio: 28.0, Stock: 25, StockMinimo: 10 },
    { ProductoID: 4, CodigoBarra: '7798765432105', Nombre: 'Alcohol en gel 250ml', Precio: 9.99, Stock: 80, StockMinimo: 10 },
    { ProductoID: 5, CodigoBarra: '7845123698745', Nombre: 'Vitamina C 1g x10', Precio: 14.5, Stock: 60, StockMinimo: 10 },
  ],
  lotes: [
    // Ejemplo: { LoteID, ProductoID, Lote, Vencimiento(YYYY-MM-DD), Cantidad }
    { LoteID: 1, ProductoID: 1, Lote: 'L-PARA-001', Vencimiento: '2026-01-15', Cantidad: 20 },
    { LoteID: 2, ProductoID: 1, Lote: 'L-PARA-002', Vencimiento: '2026-06-30', Cantidad: 30 },
    { LoteID: 3, ProductoID: 2, Lote: 'L-IBU-001',  Vencimiento: '2025-12-31', Cantidad: 40 },
    { LoteID: 4, ProductoID: 4, Lote: 'L-ALC-001',  Vencimiento: '2027-03-20', Cantidad: 80 },
  ],
  nextLoteID: 5,
};

module.exports = store;
