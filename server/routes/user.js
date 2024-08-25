//comment.js
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
// const logAuthen = require("../library/logging");

const pool = new Pool({
    user: process.env.POSTGRESQL_USER,
    password: process.env.POSTGRESQL_PASS,
    host: process.env.POSTGRESQL_HOST,
    database: process.env.POSTGRESQL_DATABASE,
    port: process.env.POSTGRESQL_PORT
});

router.get('/', (req, res) => {
 res.send('user')
});


router.post('/add', (req, res) => {
 res.send('add comments')
});
module.exports = router;