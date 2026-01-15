export function renderOrderEmail(opts: { siteUrl: string; orderId: string }) {
  const { siteUrl, orderId } = opts
  const viewUrl = `${siteUrl}/gracias?order=${encodeURIComponent(orderId)}`
  const zipUrl = `${siteUrl}/api/orders/download-zip?order=${encodeURIComponent(orderId)}`

  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#f6f7fb; padding:24px;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,.06);">
      <div style="padding:22px 22px 10px;">
        <div style="font-size:18px; font-weight:700; color:#111827;">Ziza Fotos</div>
        <div style="margin-top:10px; font-size:22px; font-weight:800; color:#111827;">¡Pago confirmado!</div>
        <div style="margin-top:6px; color:#6b7280; font-size:14px;">
          Tu orden: <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas; color:#111827;">${orderId}</span>
        </div>

        <div style="margin-top:16px; color:#374151; font-size:14px; line-height:1.5;">
          Ya puedes ver y descargar tus fotos.
        </div>

        <div style="margin-top:18px;">
          <a href="${viewUrl}" style="display:inline-block; background:#111827; color:#ffffff; text-decoration:none; padding:12px 16px; border-radius:999px; font-size:14px; font-weight:700;">
            Ver / Descargar mis fotos
          </a>
        </div>

        <div style="margin-top:14px; font-size:13px; color:#6b7280;">
          Descargar todo en ZIP: <a href="${zipUrl}" style="color:#111827;">Descargar ZIP</a>
        </div>

        <div style="margin-top:16px; font-size:12px; color:#9ca3af;">
          Si el botón no funciona, copia y pega este enlace:<br/>
          <a href="${viewUrl}" style="color:#111827;">${viewUrl}</a>
        </div>
      </div>

      <div style="padding:14px 22px 18px; border-top:1px solid #eef2f7; color:#9ca3af; font-size:12px;">
        Gracias por tu compra 💛
      </div>
    </div>
  </div>
  `
}
