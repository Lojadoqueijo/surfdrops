"use client";

// Guardar como PDF = imprimir a própria página (browser → "Guardar como PDF").
// Fonte única: o PDF sai sempre da versão web atual, sem ficheiro separado a
// divergir/envelhecer.
export function PrintButton() {
  return (
    <button className="guia-print" onClick={() => window.print()}>
      🖨️ Guardar PDF
    </button>
  );
}
