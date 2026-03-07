const express = require('express');
const router = express.Router();
const { postRequest, getRequests } = require('../controllers/requests');

router.post('/', postRequest);
router.get('/', getRequests);

module.exports = router;
