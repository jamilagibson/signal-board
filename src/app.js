const express = require('express');
const app = express();

app.use(express.json());

const usersRouter = require('./routes/users');
app.use('/users', usersRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;