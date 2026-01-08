type PriceResult = {
  quantity: number
  unit_price: number
  subtotal: number
  discount_percent: number
  discount_amount: number
  total: number
  currency: 'BRL'
}

export function calculatePhotoPrice(quantity: number): PriceResult {
  const UNIT_PRICE = 18

  let discountPercent = 0

  if (quantity >= 10) discountPercent = 20
  else if (quantity >= 5) discountPercent = 10
  else if (quantity >= 2) discountPercent = 5

  const subtotal = quantity * UNIT_PRICE
  const discountAmount = +(subtotal * (discountPercent / 100)).toFixed(2)
  const total = +(subtotal - discountAmount).toFixed(2)

  return {
    quantity,
    unit_price: UNIT_PRICE,
    subtotal,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    total,
    currency: 'BRL',
  }
}
