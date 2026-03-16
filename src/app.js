const express = require('express');
const app = express();

app.use(express.json());

const usersRouter = require('./routes/users');
app.use('/users', usersRouter);

const requestsRouter = require('./routes/requests');
app.use('/requests', requestsRouter);

const votesRouter = require('./routes/votes');
app.use('/votes', votesRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;