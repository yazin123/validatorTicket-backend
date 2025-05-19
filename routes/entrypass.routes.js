const express = require('express');
const router = express.Router();
const { purchaseEntryPass, getMyEntryPass } = require('../controllers/entrypass.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/purchase', purchaseEntryPass);
router.get('/me', getMyEntryPass);

module.exports = router; 