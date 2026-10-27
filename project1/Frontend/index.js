
const API_BASE = "http://localhost:5050";

// Get an input value
function getValue(id) {
    return document.getElementById(id).value.trim();
}

// Display a success or error message
function showMessage(id, message, isError = false) {
    const element = document.getElementById(id);
    element.textContent = message;
    element.style.color = isError ? "#DC3545" : "#198754";
}

// Send a request to the backend
async function apiRequest(endpoint, options = {}) {
    const response = await fetch(API_BASE + endpoint, options);

    const result = await response.json().catch(() => null);

    if (!result) {
        throw new Error("The server did not return valid JSON.");
    }

    if (!response.ok || result.success === false) {
        throw new Error(
            result.message || result.error || "Request failed."
        );
    }

    return result;
}

// Create options for POST requests
function postOptions(data) {
    return {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    };
}

// ============================================
// 1. USER REGISTRATION
// ============================================

document.getElementById("register-btn").addEventListener(
    "click",
    async function () {
        try {
            const username = getValue("reg-username");
            const password =
                document.getElementById("reg-password").value;
            const firstname = getValue("reg-firstname");
            const lastname = getValue("reg-lastname");
            const salaryInput = getValue("reg-salary");
            const ageInput = getValue("reg-age");

            if (!username || !password || !firstname || !lastname) {
                throw new Error("Please fill in all required fields.");
            }

            const salary = salaryInput === ""
                ? null : Number(salaryInput);
            const age = ageInput === ""
                ? null : Number(ageInput);

            if (salary !== null &&
                (!Number.isFinite(salary) || salary < 0)) {
                throw new Error("Enter a valid salary.");
            }

            if (age !== null &&
                (!Number.isInteger(age) || age < 0)) {
                throw new Error("Enter a valid age.");
            }

            const result = await apiRequest(
                "/register",
                postOptions({
                    username,
                    password,
                    firstname,
                    lastname,
                    salary,
                    age
                })
            );

            showMessage(
                "register-message",
                result.message || "Account created successfully!"
            );

            document.getElementById("reg-password").value = "";

        } catch (error) {
            showMessage("register-message", error.message, true);
        }
    }
);

// ============================================
// 2. USER SIGN-IN
// ============================================

document.getElementById("login-btn").addEventListener(
    "click",
    async function () {
        try {
            const username = getValue("login-username");
            const password =
                document.getElementById("login-password").value;

            if (!username || !password) {
                throw new Error("Enter your username and password.");
            }

            const result = await apiRequest(
                "/login",
                postOptions({ username, password })
            );

            showMessage(
                "login-message",
                result.message || "Signed in successfully!"
            );

            document.getElementById("login-password").value = "";

        } catch (error) {
            showMessage("login-message", error.message, true);
        }
    }
);

// ============================================
// DISPLAY DATABASE SEARCH RESULTS
// ============================================

function formatDate(value) {
    if (!value) return "Never";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleString();
}

function formatSalary(value) {
    if (value === null || value === undefined) return "—";

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(Number(value));
}

function displayUsers(users) {
    const tbody = document.getElementById("users-table-body");

    // Clear previous results
    tbody.replaceChildren();

    if (users.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 7;
        cell.className = "empty-state";
        cell.textContent = "No matching users found.";

        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    users.forEach(user => {
        const row = document.createElement("tr");

        const columns = [
            user.username ?? "—",
            user.firstname ?? "—",
            user.lastname ?? "—",
            formatSalary(user.salary),
            user.age ?? "—",
            formatDate(user.registerday),
            formatDate(user.signintime)
        ];

        columns.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = String(value);
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });
}

// ============================================
// GENERIC SEARCH FUNCTION
// ============================================

async function searchUsers(endpoint, params = {}, description = "") {
    try {
        const query = new URLSearchParams(params).toString();
        const url = endpoint + (query ? "?" + query : "");

        showMessage("search-message", "Searching...");

        const result = await apiRequest(url);

        // Accept a JSON array or { data: [...] }
        const users = Array.isArray(result)
            ? result
            : result.data;

        if (!Array.isArray(users)) {
            throw new Error("Unexpected search response from server.");
        }

        displayUsers(users);

        document.getElementById(
            "results-description"
        ).textContent = description;

        showMessage(
            "search-message",
            `${users.length} user(s) found.`
        );

        document.getElementById("results").scrollIntoView({
            behavior: "smooth"
        });

    } catch (error) {
        showMessage("search-message", error.message, true);
        document.getElementById("results").scrollIntoView({
            behavior: "smooth"
        });
    }
}

// ============================================
// 3. SEARCH BY FIRST AND/OR LAST NAME
// ============================================

document.getElementById("search-name-btn").addEventListener(
    "click",
    function () {
        const firstname = getValue("search-firstname");
        const lastname = getValue("search-lastname");

        if (!firstname && !lastname) {
            showMessage(
                "search-message",
                "Enter a first name or last name.",
                true
            );
            return;
        }

        searchUsers(
            "/users/search/name",
            { firstname, lastname },
            "Results for name search"
        );
    }
);

// ============================================
// 4. SEARCH BY USER ID
// ============================================

document.getElementById("search-id-btn").addEventListener(
    "click",
    function () {
        const username = getValue("search-username");

        if (!username) {
            showMessage(
                "search-message", "Enter a username.", true
            );
            return;
        }

        searchUsers(
            "/users/search/id",
            { username },
            "Results for username: " + username
        );
    }
);

// ============================================
// 5. SEARCH BY SALARY RANGE
// ============================================

document.getElementById("search-salary-btn").addEventListener(
    "click",
    function () {
        const min = getValue("salary-min");
        const max = getValue("salary-max");

        if (min === "" || max === "" ||
            !Number.isFinite(Number(min)) ||
            !Number.isFinite(Number(max)) ||
            Number(min) < 0 ||
            Number(min) > Number(max)) {
            showMessage(
                "search-message",
                "Enter a valid minimum and maximum salary.",
                true
            );
            return;
        }

        searchUsers(
            "/users/search/salary",
            { min, max },
            `Users with salaries from $${min} to $${max}`
        );
    }
);

// ============================================
// 6. SEARCH BY AGE RANGE
// ============================================

document.getElementById("search-age-btn").addEventListener(
    "click",
    function () {
        const min = getValue("age-min");
        const max = getValue("age-max");

        if (min === "" || max === "" ||
            !Number.isInteger(Number(min)) ||
            !Number.isInteger(Number(max)) ||
            Number(min) < 0 ||
            Number(min) > Number(max)) {
            showMessage(
                "search-message",
                "Enter a valid minimum and maximum age.",
                true
            );
            return;
        }

        searchUsers(
            "/users/search/age",
            { min, max },
            `Users between ages ${min} and ${max}`
        );
    }
);

// ============================================
// 7. REGISTERED AFTER ANOTHER USER
// ============================================

document.getElementById("search-after-btn").addEventListener(
    "click",
    function () {
        const username = getValue("after-username");

        if (!username) {
            showMessage(
                "search-message", "Enter a username.", true
            );
            return;
        }

        searchUsers(
            "/users/search/after",
            { username },
            `Users registered after ${username}`
        );
    }
);

// ============================================
// 8. USERS WHO NEVER SIGNED IN
// ============================================

document.getElementById("search-never-btn").addEventListener(
    "click",
    function () {
        searchUsers(
            "/users/search/never-signed-in",
            {},
            "Users who have never signed in"
        );
    }
);

// ============================================
// 9. SAME REGISTRATION DAY
// ============================================

document.getElementById("search-same-day-btn").addEventListener(
    "click",
    function () {
        const username = getValue("same-day-username");

        if (!username) {
            showMessage(
                "search-message", "Enter a username.", true
            );
            return;
        }

        searchUsers(
            "/users/search/same-day",
            { username },
            `Users registered on the same day as ${username}`
        );
    }
);

// ============================================
// 10. USERS REGISTERED TODAY
// ============================================

document.getElementById("search-today-btn").addEventListener(
    "click",
    function () {
        searchUsers(
            "/users/search/today",
            {},
            "Users registered today"
        );
    }
);
