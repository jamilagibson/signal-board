const express = require('express');
const router = express.Router();
const { postUser } = require('../controllers/users');

router.post('/', postUser);

module.exports = router;
