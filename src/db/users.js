const { timedQuery } = require('./pool');

createUser = async (email) => {
    return await timedQuery(
        'INSERT INTO users (email) VALUES ($1) RETURNING *', 
        [email]
    );
};

module.exports = { createUser };