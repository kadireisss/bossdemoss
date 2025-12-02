
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    message: "Track API çalıştı",
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress
  });
}
