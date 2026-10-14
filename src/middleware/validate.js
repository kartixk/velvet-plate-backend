const validate = (schema) => (req, res, next) => {
    try {
        req.body = schema.parse(req.body);
        next();
    } catch (err) {
        if (err.name === 'ZodError') {
            const issues = err.issues || err.errors || [];
            return res.status(400).json({
                message: "Validation Error",
                errors: issues.map(e => ({ path: (e.path || []).join('.'), message: e.message }))
            });
        }
        next(err);
    }
};

module.exports = { validate };
