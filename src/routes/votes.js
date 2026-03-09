const express = require('express');
const router = express.Router();
const { postVote } = require('../controllers/votes');

router.post('/', postVote);

module.exports = router;
