const { createUser } = require('../db/users');

const registerUser = async(email) => {
    const result = await createUser(email);
    return result.rows[0];
};

module.exports = { registerUser };