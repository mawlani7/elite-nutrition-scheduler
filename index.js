module.exports = (req, res) => {
  res.status(200).json({
    status: 'Elite Nutrition Instagram Scheduler is operational',
    timestamp: new Date().toISOString(),
    message: 'Approval emails scheduled daily at 8am UK time'
  });
};
