export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const items = (body && Array.isArray(body.items)) ? body.items : [];

    let totalPcs = 0;
    let totalCft = 0;
    let subtotal = 0;

    const calculatedItems = items.map((item, index) => {
      const lengthFt = parseFloat(item.length_ft) || 0;
      const widthIn = parseFloat(item.width_in) || 0;
      const thicknessIn = parseFloat(item.thickness_in) || 0;
      const pcs = parseInt(item.pcs, 10) || 1;
      const ratePerCft = parseFloat(item.rate_per_cft) || 0;

      const cftPerPc = (lengthFt * widthIn * thicknessIn > 0) ? (lengthFt * widthIn * thicknessIn) / 144 : 0;
      const itemTotalCft = cftPerPc * pcs;
      const itemTotalAmount = itemTotalCft * ratePerCft;

      totalPcs += pcs;
      totalCft += itemTotalCft;
      subtotal += itemTotalAmount;

      return {
        id: item.id || (index + 1),
        wood_type: item.wood_type || 'General Wood',
        length_ft: lengthFt,
        width_in: widthIn,
        thickness_in: thicknessIn,
        pcs,
        cft_per_pc: Math.round(cftPerPc * 10000) / 10000,
        total_cft: Math.round(itemTotalCft * 10000) / 10000,
        rate_per_cft: Math.round(ratePerCft * 100) / 100,
        total_amount: Math.round(itemTotalAmount * 100) / 100
      };
    });

    return res.status(200).json({
      status: 'success',
      data: {
        items: calculatedItems,
        total_pcs: totalPcs,
        total_cft: Math.round(totalCft * 1000) / 1000,
        subtotal: Math.round(subtotal * 100) / 100
      }
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
