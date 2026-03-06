const { registerUser } = require('../services/users');

const postUser = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await registerUser(email);
        res.status(201).json(user);
    } catch (err) {
        next(err);
    }
};

module.exports = { postUser };