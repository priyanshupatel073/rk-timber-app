export default function handler(req, res) {
  res.status(200).json({ ok: true, message: "Node serverless is active", time: new Date().toISOString() });
}
