const express = require('express');
const multer = require('multer');
const { runPipeline } = require('../core/pipeline');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/reconcile', upload.fields([
  { name: 'ledger', maxCount: 1 },
  { name: 'statement', maxCount: 1 }
]), async (req, res, next) => {
  try {
    if (!req.files || !req.files.ledger || !req.files.statement) {
      return res.status(400).json({ error: 'Both ledger and statement files are required.' });
    }

    const ledgerBuffer = req.files.ledger[0].buffer;
    const bankBuffer = req.files.statement[0].buffer;

    const result = runPipeline(ledgerBuffer, bankBuffer);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;