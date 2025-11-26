"use strict";
// Utility functions for input validation and sanitization
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeString = sanitizeString;
exports.validateEmail = validateEmail;
exports.validatePhone = validatePhone;
exports.sanitizePhone = sanitizePhone;
exports.validateUuid = validateUuid;
exports.sanitizeHtml = sanitizeHtml;
function sanitizeString(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }
    return input.trim();
}
function validateEmail(email) {
    if (!email)
        return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}
function validatePhone(phone) {
    if (!phone)
        return false;
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    // Brazilian phone: 10-11 digits (with or without country code)
    return cleaned.length >= 10 && cleaned.length <= 13;
}
function sanitizePhone(phone) {
    if (!phone)
        return '';
    return phone.replace(/\D/g, '');
}
function validateUuid(uuid) {
    if (!uuid)
        return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}
function sanitizeHtml(input) {
    if (!input)
        return '';
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}
