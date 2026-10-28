// database services, accessbile by DbService methods.


const mysql = require('mysql');
const dotenv = require('dotenv');

dotenv.config();

// Connect to your MySQL database
const connection = mysql.createPool({
    host: process.env.HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.PASSWORD || '',
    database: process.env.DATABASE || 'web_app',
    port: Number(process.env.DB_PORT || 3306),
    connectionLimit: 10
});

// Only return public user information.
// Never send password hashes to the frontend.
const publicFields = `
    username, firstname, lastname,
    salary, age, registerday, signintime
`;

// Reusable function for running SQL queries
function runQuery(sql, values = []) {
    return new Promise((resolve, reject) => {
        connection.query(sql, values, (error, results) => {
            if (error) {
                return reject(error);
            }

            resolve(results);
        });
    });
}

class DbService {

    // Get one shared service instance
    static getDbServiceInstance() {
        if (!DbService.instance) {
            DbService.instance = new DbService();
        }

        return DbService.instance;
    }

    // 1. REGISTER A NEW USER
    async registerUser(user) {
        const sql = `
            INSERT INTO names
            (username, password, firstname, lastname,
             salary, age, registerday, signintime)
            VALUES (?, ?, ?, ?, ?, ?, CURDATE(), NULL)
        `;

        return runQuery(sql, [
            user.username,
            user.password,
            user.firstname,
            user.lastname,
            user.salary,
            user.age
        ]);
    }

    // 2. GET USER INFORMATION FOR LOGIN
    async getUserForLogin(username) {
        const sql = `
            SELECT username, password
            FROM names
            WHERE username = ?
        `;

        const results = await runQuery(sql, [username]);

        return results[0] || null;
    }

    // 3. UPDATE THE LAST SIGN-IN TIME
    async updateSignInTime(username) {
        const sql = `
            UPDATE names
            SET signintime = NOW()
            WHERE username = ?
        `;

        return runQuery(sql, [username]);
    }

    // 4. SEARCH USERS BY FIRST AND/OR LAST NAME
    async searchByName(firstname, lastname) {
        let sql = `
            SELECT ${publicFields}
            FROM names
            WHERE 1 = 1
        `;

        const values = [];

        if (firstname) {
            sql += ' AND firstname LIKE ?';
            values.push(`%${firstname}%`);
        }

        if (lastname) {
            sql += ' AND lastname LIKE ?';
            values.push(`%${lastname}%`);
        }

        return runQuery(sql, values);
    }

    // 5. SEARCH BY USER ID (USERNAME)
    async searchById(username) {
        const sql = `
            SELECT ${publicFields}
            FROM names
            WHERE username = ?
        `;

        return runQuery(sql, [username]);
    }

    // 6. SEARCH BY SALARY RANGE
    async searchBySalary(min, max) {
        const sql = `
            SELECT ${publicFields}
            FROM names
            WHERE salary BETWEEN ? AND ?
        `;

        return runQuery(sql, [min, max]);
    }

    // 7. SEARCH BY AGE RANGE
    async searchByAge(min, max) {
        const sql = `
            SELECT ${publicFields}
            FROM names
            WHERE age BETWEEN ? AND ?
        `;

        return runQuery(sql, [min, max]);
    }

    // 8. USERS REGISTERED AFTER ANOTHER USER
    async searchRegisteredAfter(username) {
        const sql = `
            SELECT ${publicFields}
            FROM names
            WHERE registerday > (
                SELECT registerday
                FROM names
                WHERE username = ?
            )
        `;

        return runQuery(sql, [username]);
    }

    // 9. USERS WHO NEVER SIGNED IN
    async searchNeverSignedIn() {
        const sql = `
            SELECT ${publicFields}
            FROM names
            WHERE signintime IS NULL
        `;

        return runQuery(sql);
    }

    // 10. USERS REGISTERED ON THE SAME DAY
    async searchSameDay(username) {
        const sql = `
            SELECT ${publicFields}
            FROM names
            WHERE registerday = (
                SELECT registerday
                FROM names
                WHERE username = ?
            )
        `;

        return runQuery(sql, [username]);
    }

    // 11. USERS WHO REGISTERED TODAY
    async searchRegisteredToday() {
        const sql = `
            SELECT ${publicFields}
            FROM names
            WHERE registerday = CURDATE()
        `;

        return runQuery(sql);
    }

    // EXTRA: GET ALL USERS WITHOUT PASSWORDS
    async getAllData() {
        const sql = `
            SELECT ${publicFields}
            FROM names
        `;

        return runQuery(sql);
    }
}

// Export the class so app.js can use it
module.exports = DbService;

