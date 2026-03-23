const rateLimit = require('express-rate-limit');

// 1. Rate Limiting for Registrations
const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 registrations per windowMs
    message: { message: "Too many registrations from this IP, please try again after 15 minutes." }
});

// 2. Disposable Email Blocker (extended list)
const disposableEmailDomains = [
    'tempmail.com', '10minutemail.com', 'mailinator.com', 'guerrillamail.com', 'yopmail.com',
    'throwaway.email', 'temp-mail.org', 'fakeinbox.com', 'sharklasers.com', 'guerrillamail.info',
    'trashmail.com', 'maildrop.cc', 'getnada.com', 'tempail.com', 'dispostable.com'
];

const blockDisposableEmails = (req, res, next) => {
    const { email } = req.body;
    if (email) {
        const domain = (email.split('@')[1] || '').toLowerCase();
        if (disposableEmailDomains.includes(domain)) {
            return res.status(400).json({ message: "Disposable/temporary emails are not allowed." });
        }
    }
    next();
};

module.exports = {
    registerLimiter,
    blockDisposableEmails
};
