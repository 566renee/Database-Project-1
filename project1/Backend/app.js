// Backend: application services, accessible by URIs



const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

const DbService = require('./dbService');

const app = express();
const db = DbService.getDbServiceInstance();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Handle errors from asynchronous routes
const handle = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Validate numeric ranges
function validRange(req, res, integerOnly = false) {
    const { min, max } = req.query;

    if (min === undefined || max === undefined ||
        String(min).trim() === '' ||
        String(max).trim() === '') {
        res.status(400).json({
            error: 'Both min and max are required.'
        });
        return null;
    }

    const minimum = Number(min);
    const maximum = Number(max);

    if (!Number.isFinite(minimum) ||
        !Number.isFinite(maximum) ||
        minimum < 0 ||
        maximum < minimum ||
        (integerOnly &&
         (!Number.isInteger(minimum) ||
          !Number.isInteger(maximum)))) {
        res.status(400).json({
            error: 'Invalid minimum or maximum value.'
        });
        return null;
    }

    return { minimum, maximum };
}

// 1. REGISTER
app.post('/register', handle(async (req, res) => {
    const {
        username,
        password,
        firstname,
        lastname,
        salary,
        age
    } = req.body || {};

    if ([username, password, firstname, lastname].some(
        value => typeof value !== 'string' ||
                 !value.trim()
    )) {
        return res.status(400).json({
            error: 'Username, password, first name and last name are required.'
        });
    }

    const cleanUsername = username.trim();

    if (cleanUsername.length > 50 ||
        firstname.trim().length > 50 ||
        lastname.trim().length > 50 ||
        password.length < 8 ||
        password.length > 72) {
        return res.status(400).json({
            error: 'Invalid field length. Password must be 8-72 characters.'
        });
    }

    const parsedSalary =
        salary === undefined || salary === '' || salary === null
            ? null : Number(salary);

    const parsedAge =
        age === undefined || age === '' || age === null
            ? null : Number(age);

    if ((parsedSalary !== null &&
         (!Number.isFinite(parsedSalary) ||
          parsedSalary < 0 || parsedSalary > 99999999.99)) ||
        (parsedAge !== null &&
         (!Number.isInteger(parsedAge) ||
          parsedAge < 0 || parsedAge > 150))) {
        return res.status(400).json({
            error: 'Invalid salary or age.'
        });
    }

    // Hash the password before saving it
    const hashedPassword = await bcrypt.hash(password, 12);

    try {
        await db.registerUser({
            username: cleanUsername,
            password: hashedPassword,
            firstname: firstname.trim(),
            lastname: lastname.trim(),
            salary: parsedSalary,
            age: parsedAge
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: 'Username already exists.'
            });
        }
        throw error;
    }

    return res.status(201).json({
        success: true,
        message: 'Registration successful.'
    });
}));

// 2. LOGIN
app.post('/login', handle(async (req, res) => {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' ||
        typeof password !== 'string' ||
        !username.trim() || !password) {
        return res.status(400).json({
            error: 'Username and password are required.'
        });
    }

    const user = await db.getUserForLogin(username.trim());

    if (!user) {
        return res.status(401).json({
            error: 'Invalid username or password.'
        });
    }

    const validPassword = await bcrypt.compare(
        password, user.password
    );

    if (!validPassword) {
        return res.status(401).json({
            error: 'Invalid username or password.'
        });
    }

    await db.updateSignInTime(user.username);

    return res.json({
        success: true,
        message: 'Login successful.',
        username: user.username
    });
}));

// 3. SEARCH BY FIRST AND/OR LAST NAME
app.get('/users/search/name', handle(async (req, res) => {
    const { firstname, lastname } = req.query;

    const first = typeof firstname === 'string'
        ? firstname.trim() : '';
    const last = typeof lastname === 'string'
        ? lastname.trim() : '';

    if (!first && !last) {
        return res.status(400).json({
            error: 'Provide firstname or lastname.'
        });
    }

    const data = await db.searchByName(first, last);
    res.json({ data });
}));

// 4. SEARCH BY USER ID
app.get('/users/search/id', handle(async (req, res) => {
    const { username } = req.query;

    if (typeof username !== 'string' || !username.trim()) {
        return res.status(400).json({
            error: 'Username is required.'
        });
    }

    const data = await db.searchById(username.trim());
    res.json({ data });
}));

// 5. SEARCH BY SALARY RANGE
app.get('/users/search/salary', handle(async (req, res) => {
    const range = validRange(req, res);
    if (!range) return;

    const data = await db.searchBySalary(
        range.minimum,
        range.maximum
    );
    res.json({ data });
}));

// 6. SEARCH BY AGE RANGE
app.get('/users/search/age', handle(async (req, res) => {
    const range = validRange(req, res, true);
    if (!range) return;

    const data = await db.searchByAge(
        range.minimum,
        range.maximum
    );
    res.json({ data });
}));

// 7. REGISTERED AFTER A USER
app.get('/users/search/after', handle(async (req, res) => {
    const { username } = req.query;

    if (typeof username !== 'string' || !username.trim()) {
        return res.status(400).json({
            error: 'Username is required.'
        });
    }

    const data = await db.searchRegisteredAfter(username.trim());
    res.json({ data });
}));

// 8. NEVER SIGNED IN
app.get('/users/search/never-signed-in',
    handle(async (req, res) => {
        const data = await db.searchNeverSignedIn();
        res.json({ data });
    })
);

// 9. REGISTERED ON SAME DAY
app.get('/users/search/same-day', handle(async (req, res) => {
    const { username } = req.query;

    if (typeof username !== 'string' || !username.trim()) {
        return res.status(400).json({
            error: 'Username is required.'
        });
    }

    const data = await db.searchSameDay(username.trim());
    res.json({ data });
}));

// 10. REGISTERED TODAY
app.get('/users/search/today', handle(async (req, res) => {
    const data = await db.searchRegisteredToday();
    res.json({ data });
}));

// Additional endpoint to retrieve all users
app.get('/getAll', handle(async (req, res) => {
    const data = await db.getAllData();
    res.json({ data });
}));

// Return a proper error without exposing database details
app.use((error, req, res, next) => {
    console.error('Backend error:', error);

    if (error instanceof SyntaxError &&
        error.status === 400 &&
        'body' in error) {
        return res.status(400).json({
            error: 'Invalid JSON request.'
        });
    }

    return res.status(500).json({
        error: 'An internal server error occurred.'
    });
});

const PORT = Number(process.env.PORT || 5050);

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
