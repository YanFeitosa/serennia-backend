"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
// Re-export Supabase auth middleware for backward compatibility
var supabaseAuth_1 = require("./supabaseAuth");
Object.defineProperty(exports, "authMiddleware", { enumerable: true, get: function () { return supabaseAuth_1.supabaseAuthMiddleware; } });
