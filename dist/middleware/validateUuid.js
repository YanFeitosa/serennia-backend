"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUuidParam = void 0;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validateUuidParam = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName];
        if (id && !UUID_REGEX.test(id)) {
            res.status(400).json({ error: `Invalid ${paramName} format. Must be a valid UUID.` });
            return;
        }
        next();
    };
};
exports.validateUuidParam = validateUuidParam;
