require("dotenv").config();

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const path = require("path");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

const app = express();


// ==========================================
// CONFIGURATION
// ==========================================

const PORT = process.env.PORT || 3000;

const IS_PROD =
    process.env.NODE_ENV === "production" ||
    !!process.env.VERCEL;

// OAuth callback ke liye base URL
// (Vercel par BASE_URL=https://aw-lab5.vercel.app set karein)
const BASE_URL =
    process.env.BASE_URL ||
    `http://localhost:${PORT}`;

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "CSC337_LAB5_SUPER_SECRET_KEY";

const ACCESS_TOKEN_EXPIRY = "15m";

const REFRESH_TOKEN_EXPIRY =
    7 * 24 * 60 * 60 * 1000;

const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_EXPIRY
};


// ==========================================
// BASIC MIDDLEWARE
// ==========================================

// Vercel/proxy ke peeche rate-limit aur secure cookies ke liye
app.set("trust proxy", 1);

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                // localhost (http) par assets ko https mein na badle
                "upgrade-insecure-requests": null
            }
        }
    })
);

app.use(express.json({
    limit: "10kb"
}));

app.use(cookieParser());

// Frontend page (public/index.html) serve karo
app.use(express.static(path.join(__dirname, "public")));


// ==========================================
// CORS
// ==========================================

app.use(
    cors({
        origin:
            process.env.CLIENT_URL ||
            "http://localhost:3000",

        methods: [
            "GET",
            "POST",
            "PUT",
            "DELETE"
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ],

        credentials: true
    })
);


// ==========================================
// SESSION
// ==========================================

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "CSC337_LAB5_SESSION_SECRET",

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: false,
            sameSite: "strict"
        }
    })
);

app.use(passport.initialize());

app.use(passport.session());


// ==========================================
// IN-MEMORY DATA
// ==========================================

let users = [];

let refreshTokens = [];

// ==========================================
// TEST USERS FOR VIVA
// ==========================================

async function createTestUsers() {

    const testUsers = [
        {
            name: "Super Admin",
            email: "superadmin@awlab5.com",
            password: "SuperAdmin@123",
            role: "SuperAdmin"
        },
        {
            name: "Lab Manager",
            email: "manager@awlab5.com",
            password: "Manager@123",
            role: "Manager"
        },
        {
            name: "Lab Employee",
            email: "employee@awlab5.com",
            password: "Employee@123",
            role: "Employee"
        }
    ];

    for (const testUser of testUsers) {

        const hashedPassword = await bcrypt.hash(
            testUser.password,
            12
        );

        users.push({
            id: users.length + 1,
            name: testUser.name,
            email: testUser.email,
            password: hashedPassword,
            role: testUser.role,
            failedAttempts: 0,
            lockedUntil: null
        });
    }
}


// ==========================================
// INPUT SANITIZATION
// ==========================================

function sanitize(value) {

    if (typeof value !== "string") {
        return value;
    }

    return value
        .replace(/[<>]/g, "")
        .replace(/\$/g, "")
        .replace(/\{/g, "")
        .replace(/\}/g, "")
        .trim();
}


function sanitizeObject(obj) {

    if (!obj || typeof obj !== "object") {
        return obj;
    }

    for (const key in obj) {

        if (typeof obj[key] === "string") {
            obj[key] = sanitize(obj[key]);
        }
    }

    return obj;
}


app.use((req, res, next) => {

    if (req.body) {
        sanitizeObject(req.body);
    }

    if (req.query) {
        sanitizeObject(req.query);
    }

    next();
});


// ==========================================
// LOGIN RATE LIMITING
// ==========================================

const loginLimiter = rateLimit({

    windowMs: 15 * 60 * 1000,

    max: 5,

    message: {
        message:
            "Too many login attempts. Try again after 15 minutes."
    }

});


// ==========================================
// HOME ROUTE
// ==========================================

app.get("/api/health", (req, res) => {

    res.json({
        message:
            "CSC337 Lab 5 Enterprise Security API is working!"
    });

});


// ==========================================
// REGISTER
// ==========================================

app.post(
    "/api/v1/auth/register",
    async (req, res) => {

        try {

            const {
                name,
                email,
                password
            } = req.body;


            if (!name || !email || !password) {

                return res.status(400).json({
                    message:
                        "Name, email and password are required"
                });

            }


            if (password.length < 8) {

                return res.status(400).json({
                    message:
                        "Password must be at least 8 characters"
                });

            }


            const existingUser =
                users.find(
                    user =>
                        user.email === email
                );


            if (existingUser) {

                return res.status(409).json({
                    message:
                        "User already exists"
                });

            }


            const hashedPassword =
                await bcrypt.hash(
                    password,
                    12
                );


            const newUser = {

                id: users.length + 1,

                name: name,

                email: email,

                password: hashedPassword,

                role: "Employee",

                failedAttempts: 0,

                lockedUntil: null

            };


            users.push(newUser);


            res.status(201).json({

                message:
                    "User registered successfully",

                user: {

                    id: newUser.id,

                    name: newUser.name,

                    email: newUser.email,

                    role: newUser.role

                }

            });

        }

        catch (error) {

            console.error(error);

            res.status(500).json({
                message: "Server error"
            });

        }

    }
);


// ==========================================
// CREATE ACCESS TOKEN
// ==========================================

function createAccessToken(user) {

    return jwt.sign(

        {
            id: user.id,

            name: user.name,

            email: user.email,

            role: user.role

        },

        JWT_SECRET,

        {
            expiresIn:
                ACCESS_TOKEN_EXPIRY
        }

    );

}


// ==========================================
// CREATE REFRESH TOKEN
// ==========================================

function createRefreshToken(user) {

    const token =
        crypto.randomBytes(64).toString("hex");


    refreshTokens.push({

        token: token,

        userId: user.id,

        expiresAt:
            Date.now() +
            REFRESH_TOKEN_EXPIRY

    });


    return token;

}


// ==========================================
// LOGIN
// ==========================================

app.post(
    "/api/v1/auth/login",

    loginLimiter,

    async (req, res) => {

        try {

            const {
                email,
                password
            } = req.body;


            if (!email || !password) {

                return res.status(400).json({
                    message:
                        "Email and password are required"
                });

            }


            const user =
                users.find(
                    user =>
                        user.email === email
                );


            if (!user || !user.password) {

                return res.status(401).json({
                    message:
                        "Invalid email or password"
                });

            }


            // ACCOUNT LOCKOUT

            if (
                user.lockedUntil &&
                user.lockedUntil > Date.now()
            ) {

                return res.status(423).json({
                    message:
                        "Account temporarily locked"
                });

            }


            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );


            if (!passwordMatch) {

                user.failedAttempts++;


                if (
                    user.failedAttempts >= 5
                ) {

                    user.lockedUntil =
                        Date.now() +
                        15 * 60 * 1000;

                    user.failedAttempts = 0;


                    return res.status(423).json({

                        message:
                            "Account locked for 15 minutes"

                    });

                }


                return res.status(401).json({

                    message:
                        "Invalid email or password"

                });

            }


            // SUCCESSFUL LOGIN

            user.failedAttempts = 0;

            user.lockedUntil = null;


            const accessToken =
                createAccessToken(user);


            const refreshToken =
                createRefreshToken(user);


            res.cookie(
                "refreshToken",
                refreshToken,
                REFRESH_COOKIE_OPTIONS
            );


            res.json({

                message:
                    "Login successful",

                accessToken:
                    accessToken,

                user: {

                    id: user.id,

                    name: user.name,

                    email: user.email,

                    role: user.role

                }

            });

        }

        catch (error) {

            console.error(error);

            res.status(500).json({
                message: "Server error"
            });

        }

    }
);


// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================

function authenticateToken(
    req,
    res,
    next
) {

    const authHeader =
        req.headers.authorization;


    if (!authHeader) {

        return res.status(401).json({

            message:
                "Authorization header required"

        });

    }


    const token =
        authHeader.split(" ")[1];


    if (!token) {

        return res.status(401).json({

            message:
                "Access token required"

        });

    }


    try {

        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        req.user = decoded;


        next();

    }

    catch (error) {

        return res.status(403).json({

            message:
                "Invalid or expired access token"

        });

    }

}


// ==========================================
// RBAC MIDDLEWARE
// ==========================================

function authorizeRoles(
    ...roles
) {

    return (req, res, next) => {

        if (!req.user) {

            return res.status(401).json({

                message:
                    "Authentication required"

            });

        }


        if (
            !roles.includes(
                req.user.role
            )
        ) {

            return res.status(403).json({

                message:
                    "Access denied"

            });

        }


        next();

    };

}


// ==========================================
// MY PROFILE
// ==========================================

app.get(
    "/api/v1/my/profile",

    authenticateToken,

    (req, res) => {

        res.json({

            message:
                "Profile accessed successfully",

            user:
                req.user

        });

    }
);


// ==========================================
// EMPLOYEE PROFILE
// All roles allowed
// ==========================================

app.get(
    "/api/v1/employees/profile",

    authenticateToken,

    authorizeRoles(
        "SuperAdmin",
        "Manager",
        "Employee"
    ),

    (req, res) => {

        res.json({

            message:
                "Employee profile accessed successfully",

            user:
                req.user

        });

    }
);


// ==========================================
// SUPERADMIN DASHBOARD
// ==========================================

app.get(
    "/api/v1/admin/dashboard",

    authenticateToken,

    authorizeRoles(
        "SuperAdmin"
    ),

    (req, res) => {

        res.json({

            message:
                "Welcome SuperAdmin"

        });

    }
);


// ==========================================
// MANAGER DASHBOARD
// SuperAdmin + Manager
// ==========================================

app.get(
    "/api/v1/manager/dashboard",

    authenticateToken,

    authorizeRoles(
        "SuperAdmin",
        "Manager"
    ),

    (req, res) => {

        res.json({

            message:
                "Welcome Manager"

        });

    }
);


// ==========================================
// EMPLOYEE DASHBOARD
// All roles
// ==========================================

app.get(
    "/api/v1/employee/dashboard",

    authenticateToken,

    authorizeRoles(
        "SuperAdmin",
        "Manager",
        "Employee"
    ),

    (req, res) => {

        res.json({

            message:
                "Welcome Employee"

        });

    }
);


// ==========================================
// PAYROLL APPROVE
// Manager + SuperAdmin
// ==========================================

app.post(
    "/api/v1/payroll/approve",

    authenticateToken,

    authorizeRoles(
        "SuperAdmin",
        "Manager"
    ),

    (req, res) => {

        res.json({

            message:
                "Payroll approved successfully",

            approvedBy:
                req.user.role

        });

    }
);


// ==========================================
// LIST USERS
// SuperAdmin ONLY
// ==========================================

app.get(
    "/api/v1/users",

    authenticateToken,

    authorizeRoles(
        "SuperAdmin"
    ),

    (req, res) => {

        res.json({

            count: users.length,

            users: users.map(user => ({

                id: user.id,

                name: user.name,

                email: user.email,

                role: user.role

            }))

        });

    }
);


// ==========================================
// DELETE USER
// SuperAdmin ONLY
// ==========================================

app.delete(
    "/api/v1/users/:id",

    authenticateToken,

    authorizeRoles(
        "SuperAdmin"
    ),

    (req, res) => {

        const userId =
            Number(req.params.id);


        const userIndex =
            users.findIndex(
                user =>
                    user.id === userId
            );


        if (userIndex === -1) {

            return res.status(404).json({

                message:
                    "User not found"

            });

        }


        users.splice(
            userIndex,
            1
        );


        res.json({

            message:
                "User deleted successfully"

        });

    }
);


// ==========================================
// CHANGE USER ROLE
// SuperAdmin ONLY
// ==========================================

app.put(
    "/api/v1/users/:id/role",

    authenticateToken,

    authorizeRoles(
        "SuperAdmin"
    ),

    (req, res) => {

        const userId =
            Number(req.params.id);


        const {
            role
        } = req.body;


        const allowedRoles = [

            "SuperAdmin",

            "Manager",

            "Employee"

        ];


        if (
            !allowedRoles.includes(role)
        ) {

            return res.status(400).json({

                message:
                    "Invalid role"

            });

        }


        const user =
            users.find(
                user =>
                    user.id === userId
            );


        if (!user) {

            return res.status(404).json({

                message:
                    "User not found"

            });

        }


        user.role = role;


        res.json({

            message:
                "User role updated successfully",

            user: {

                id: user.id,

                name: user.name,

                email: user.email,

                role: user.role

            }

        });

    }
);


// ==========================================
// REFRESH TOKEN
// 7 DAYS + ROTATION
// ==========================================

app.post(
    "/api/v1/auth/refresh",

    (req, res) => {

        const oldToken =
            req.cookies.refreshToken;


        if (!oldToken) {

            return res.status(401).json({

                message:
                    "Refresh token required"

            });

        }


        const storedToken =
            refreshTokens.find(

                item =>
                    item.token ===
                    oldToken

            );


        if (!storedToken) {

            return res.status(403).json({

                message:
                    "Invalid refresh token"

            });

        }


        if (
            storedToken.expiresAt <
            Date.now()
        ) {

            refreshTokens =
                refreshTokens.filter(

                    item =>
                        item.token !==
                        oldToken

                );


            return res.status(403).json({

                message:
                    "Refresh token expired"

            });

        }


        const user =
            users.find(

                user =>
                    user.id ===
                    storedToken.userId

            );


        if (!user) {

            return res.status(404).json({

                message:
                    "User not found"

            });

        }


        // REMOVE OLD TOKEN

        refreshTokens =
            refreshTokens.filter(

                item =>
                    item.token !==
                    oldToken

            );


        // CREATE NEW TOKENS

        const newAccessToken =
            createAccessToken(user);


        const newRefreshToken =
            createRefreshToken(user);


        res.cookie(

            "refreshToken",

            newRefreshToken,

            REFRESH_COOKIE_OPTIONS

        );


        res.json({

            message:
                "Token refreshed successfully",

            accessToken:
                newAccessToken

        });

    }
);


// ==========================================
// LOGOUT
// ==========================================

app.post(
    "/api/v1/auth/logout",

    (req, res) => {

        const token =
            req.cookies.refreshToken;


        if (token) {

            refreshTokens =
                refreshTokens.filter(

                    item =>
                        item.token !==
                        token

                );

        }


        res.clearCookie(
            "refreshToken"
        );


        res.json({

            message:
                "Logout successful"

        });

    }
);


// ==========================================
// OAUTH 2.0 (GOOGLE + GITHUB)
// ==========================================

passport.serializeUser(
    (user, done) => {

        done(
            null,
            user.id
        );

    }
);


passport.deserializeUser(
    (id, done) => {

        const user =
            users.find(
                user =>
                    user.id === id
            );

        done(
            null,
            user
        );

    }
);


// Provider se aaye user ko dhoondo ya naya Employee banao
function findOrCreateOAuthUser(
    provider,
    profile,
    email
) {

    const idField = provider + "Id";

    let user =
        users.find(
            user =>
                user[idField] === profile.id
        );

    if (!user) {

        user = {

            id:
                users.length + 1,

            name:
                profile.displayName ||
                profile.username ||
                email,

            email: email,

            [idField]:
                profile.id,

            role:
                "Employee",

            failedAttempts:
                0,

            lockedUntil:
                null

        };

        users.push(user);

    }

    return user;
}


// Login ke baad: refresh cookie lagao aur page par wapas bhejo
function finishOAuthLogin(req, res) {

    const accessToken =
        createAccessToken(req.user);

    const refreshToken =
        createRefreshToken(req.user);

    res.cookie(
        "refreshToken",
        refreshToken,
        REFRESH_COOKIE_OPTIONS
    );

    res.redirect(
        "/?token=" +
        encodeURIComponent(accessToken)
    );
}


function registerOAuthRoutes(
    provider,
    options
) {

    app.get(
        `/auth/${provider}`,

        passport.authenticate(
            provider,
            options
        )
    );

    app.get(
        `/auth/${provider}/callback`,

        passport.authenticate(
            provider,
            {
                failureRedirect:
                    "/?error=oauth_failed",

                session: false
            }
        ),

        finishOAuthLogin
    );
}


function oauthNotConfigured(provider) {

    app.get(
        `/auth/${provider}`,

        (req, res) => {

            res.status(501).json({

                message:
                    `${provider} OAuth is not configured. ` +
                    "Set CLIENT_ID and CLIENT_SECRET in environment variables."

            });

        }
    );
}


// ---------- GOOGLE ----------

if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET
) {

    passport.use(

        new GoogleStrategy(

            {

                clientID:
                    process.env.GOOGLE_CLIENT_ID,

                clientSecret:
                    process.env.GOOGLE_CLIENT_SECRET,

                callbackURL:
                    `${BASE_URL}/auth/google/callback`

            },

            (
                accessToken,
                refreshToken,
                profile,
                done
            ) => {

                const email =
                    profile.emails?.[0]?.value ||
                    `${profile.id}@google.local`;

                done(
                    null,
                    findOrCreateOAuthUser(
                        "google",
                        profile,
                        email
                    )
                );

            }

        )
    );

    registerOAuthRoutes(
        "google",
        {
            scope: [
                "profile",
                "email"
            ],

            session: false
        }
    );

}
else {

    oauthNotConfigured("google");

}


// ---------- GITHUB ----------

if (
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET
) {

    passport.use(

        new GitHubStrategy(

            {

                clientID:
                    process.env.GITHUB_CLIENT_ID,

                clientSecret:
                    process.env.GITHUB_CLIENT_SECRET,

                callbackURL:
                    `${BASE_URL}/auth/github/callback`,

                scope: [
                    "user:email"
                ]

            },

            (
                accessToken,
                refreshToken,
                profile,
                done
            ) => {

                const email =
                    profile.emails?.[0]?.value ||
                    `${profile.username}@github.local`;

                done(
                    null,
                    findOrCreateOAuthUser(
                        "github",
                        profile,
                        email
                    )
                );

            }

        )
    );

    registerOAuthRoutes(
        "github",
        {
            session: false
        }
    );

}
else {

    oauthNotConfigured("github");

}


// ==========================================
// 404 HANDLER
// ==========================================

app.use(
    (req, res) => {

        res.status(404).json({

            message:
                "Route not found"

        });

    }
);


// ==========================================
// ERROR HANDLER
// ==========================================

app.use(
    (err, req, res, next) => {

        console.error(err);


        res.status(500).json({

            message:
                "Internal server error"

        });

    }
);


// ==========================================
// START SERVER
// ==========================================

createTestUsers().then(() => {
    if (process.env.NODE_ENV !== "production") {
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    }
});

module.exports = app;