export default function handler(req, res) {
  res.status(200).json({
    status: 'Elite Nutrition Instagram Scheduler is running',
    timestamp: new Date().toISOString(),
    message: 'System operational - approval emails scheduled for 8am UK daily'
  });
}
