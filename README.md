# AW Lab 5 – Authentication & Authorization System

## 📌 Project Overview

This project is an authentication and authorization system developed for Advanced Web Lab 5.

The application demonstrates secure user authentication, OAuth login, JWT-based authentication, refresh token rotation, role-based access control (RBAC), rate limiting/account lockout, and API testing using Postman.

The system supports three user roles:

* SuperAdmin
* Manager
* Employee

---

## 🚀 Technologies Used

* Node.js
* Express.js
* JavaScript
* JWT Authentication
* OAuth 2.0
* REST API
* Postman
* Git & GitHub

---

## 📂 Project Structure

```text
AW-Lab5/
│
├── server.js
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

> Note: `.env` contains sensitive configuration and is intentionally excluded from the public repository.

---

## ⚙️ Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/yameena480/AW-Lab5.git
```

### 2. Open the project

```bash
cd AW-Lab5
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root.

Example:

```env
PORT=3000
JWT_SECRET=your_jwt_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret

OAUTH_CLIENT_ID=your_client_id
OAUTH_CLIENT_SECRET=your_client_secret
OAUTH_CALLBACK_URL=your_callback_url
```

**Do not upload the `.env` file to GitHub.**

### 5. Start the server

```bash
node server.js
```

The application will run on:

```text
http://localhost:3000
```

---

# 🔐 Authentication

The application uses token-based authentication.

After successful login, the user receives an access token and a refresh token.

The access token is used to access protected APIs.

The refresh token is used to obtain a new access token when the access token expires.

---

# 🌐 OAuth Login

The application supports OAuth-based login.

OAuth allows users to authenticate using an external identity provider instead of creating a separate password for the application.

### OAuth Flow

```text
User
  ↓
OAuth Login
  ↓
Identity Provider
  ↓
User Authentication
  ↓
Authorization Code
  ↓
Backend
  ↓
Tokens
  ↓
Authenticated User
```

OAuth credentials and secrets are stored in environment variables and are not committed to GitHub.

---

# 🔄 Refresh Token Rotation

Refresh Token Rotation is implemented to improve security.

When a valid refresh token is used:

1. The server verifies the refresh token.
2. The old refresh token is invalidated.
3. A new access token is generated.
4. A new refresh token is generated.
5. The new refresh token is returned to the client.

This helps reduce the risk of refresh-token reuse.

### Flow

```text
Refresh Token
      ↓
Server Verification
      ↓
Old Token Invalidated
      ↓
New Access Token
      +
New Refresh Token
```

---

# 🚫 Rate Limiting / Account Lockout

The application protects authentication endpoints against repeated failed login attempts.

If a user repeatedly enters incorrect login credentials, the system can restrict further login attempts.

This helps protect against:

* Brute-force attacks
* Repeated password guessing
* Automated login attempts

### Example Flow

```text
Login Attempt
      ↓
Credentials Valid?
   ↙       ↘
 Yes        No
 ↓          ↓
Login     Failed Attempt
            ↓
       Attempt Limit
            ↓
       Account Locked
```

---

# 👥 Role-Based Access Control (RBAC)

The system uses Role-Based Access Control.

Each user is assigned a role, and access to protected resources depends on that role.

### Roles

| Role       | Description             |
| ---------- | ----------------------- |
| SuperAdmin | Highest level of access |
| Manager    | Management-level access |
| Employee   | Basic employee access   |

### RBAC Flow

```text
User Login
    ↓
JWT Token
    ↓
User Role
    ↓
Authorization Middleware
    ↓
Access Allowed / Rejected
```

If a user attempts to access an endpoint that is not allowed for their role, the server rejects the request.

---

# 🧪 Postman Testing

The APIs can be tested using Postman.

### Authentication Testing

Test the following:

* Login
* OAuth Login
* Access Token
* Refresh Token
* Refresh Token Rotation
* Invalid Token
* Expired Token

### Security Testing

Test:

* Multiple failed login attempts
* Account lockout/rate limiting
* Invalid credentials
* Unauthorized requests
* Expired access token

### RBAC Testing

Use different accounts to verify role permissions.

For example:

```text
SuperAdmin → SuperAdmin Protected Endpoint → Allowed
Manager    → SuperAdmin Protected Endpoint → Rejected
Employee   → Manager/SuperAdmin Endpoint → Rejected
```

The rejected request should return an appropriate HTTP error response such as `401 Unauthorized` or `403 Forbidden`, depending on the implementation.

---

# 🔑 Test Credentials

The following test accounts are provided for viva and API testing:

| Role       | Name         | Email                   | Password         |
| ---------- | ------------ | ----------------------- | ---------------- |
| SuperAdmin | Super Admin  | `superadmin@awlab5.com` | `SuperAdmin@123` |
| Manager    | Lab Manager  | `manager@awlab5.com`    | `Manager@123`    |
| Employee   | Lab Employee | `employee@awlab5.com`   | `Employee@123`   |

These accounts are for testing and viva demonstration purposes only.

### Role Testing

* **SuperAdmin:** Full administrative access, including user deletion and role management.
* **Manager:** Manager-level access, including payroll approval.
* **Employee:** Basic employee-level access.

These credentials should only be used for demonstration/testing and should not contain real personal information.


---

# 📡 API Endpoints

Update the endpoint paths below according to the actual implementation.

| Method | Endpoint         | Purpose                            |
| ------ | ---------------- | ---------------------------------- |
| POST   | `/login`         | User login                         |
| GET    | `/auth/oauth`    | OAuth login                        |
| POST   | `/refresh-token` | Generate new access/refresh tokens |
| GET    | `/protected`     | Protected resource                 |
| GET    | `/admin`         | SuperAdmin resource                |
| GET    | `/manager`       | Manager resource                   |
| GET    | `/employee`      | Employee resource                  |

---

# 🔒 Security Features

The project demonstrates the following security concepts:

* Password authentication
* Password hashing
* JWT access tokens
* Refresh tokens
* Refresh token rotation
* OAuth authentication
* Role-Based Access Control
* Rate limiting
* Account lockout
* Protected API endpoints
* Unauthorized access rejection
* Environment variables for sensitive configuration

Passwords should never be stored as plain text.

---

# 🌍 Deployment

The application is intended to be deployed using a platform such as:

* Railway
* Render
* Vercel

The deployed application should use HTTPS.

### Live Backend URL

```text
PASTE_YOUR_RAILWAY_OR_RENDER_URL_HERE
```

### Live Frontend URL

```text
PASTE_YOUR_VERCEL_URL_HERE
```

---

# 📋 Viva Demonstration Checklist

During the viva, demonstrate:

### 1. OAuth Login

Show the OAuth authentication flow and successful login.

### 2. Refresh Token Rotation

Show that using a refresh token generates a new refresh token and that the previous token cannot be reused.

### 3. Rate Limiting / Account Lockout

Perform multiple failed login attempts and demonstrate the security restriction.

### 4. RBAC Access Rejection

Use Postman with different user roles.

Example:

```text
Employee Token
      ↓
Admin Endpoint
      ↓
403 Forbidden
```

This demonstrates that users cannot access resources outside their assigned permissions.

---

# 📦 GitHub Repository

Public Repository:

https://github.com/yameena480/AW-Lab5

---

# 👩‍💻 Author

**Yameena Murtaza**

Advanced Web Lab – Lab 5

---

## ⚠️ Security Notice

Never commit the following files or values to a public GitHub repository:

* `.env`
* Passwords
* JWT secrets
* OAuth client secrets
* API keys
* Database credentials
* Private keys

These values should be stored securely using environment variables.
