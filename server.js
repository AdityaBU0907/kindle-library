const express = require("express");
const multer = require("multer");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const ADMIN_PASSWORD = process.env.ADMIN_PASS || "aditya123"; // CHANGE THIS!
const uploadDir = path.join(__dirname, "uploads");
const booksDir = path.join(__dirname, "books");

// Ensure folders exist
[uploadDir, booksDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- MIDDLEWARE ---
app.use(express.urlencoded({ extended: true })); // For form data
app.use("/books", express.static(booksDir)); // Serve books
app.use(session({
    secret: 'kindle-secret-key-change-me',
    resave: false,
    saveUninitialized: true
}));

// Auth Middleware protection
function isAuthenticated(req, res, next) {
    if (req.session.loggedIn) return next();
    res.redirect("/login");
}

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + "_" + file.originalname)
});
const upload = multer({ storage });

// --- ROUTES ---

// 1. Public Library (Read Only)
app.get("/", (req, res) => {
    const books = fs.readdirSync(booksDir).filter(f => f.endsWith(".azw3") || f.endsWith(".mobi") || f.endsWith(".pdf"));
    res.sendFile(path.join(__dirname, "views/index.html"));
});

// API to get list of books (for frontend)
app.get("/api/books", (req, res) => {
    const books = fs.readdirSync(booksDir).filter(f => !f.startsWith("."));
    res.json(books);
});

// 2. Login Routes
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "views/login.html"));
});

app.post("/login", (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        req.session.loggedIn = true;
        res.redirect("/admin");
    } else {
        res.redirect("/login?error=1");
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

// 3. Admin Dashboard (Protected)
app.get("/admin", isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, "views/admin.html"));
});

// 4. Upload & Convert
app.post("/upload", isAuthenticated, upload.single("pdf"), (req, res) => {
    if (!req.file) return res.send("No file uploaded.");

    const inputPath = req.file.path;
    // Clean filename: remove spaces/special chars for safety
    const safeName = path.parse(req.file.originalname).name.replace(/[^a-z0-9]/gi, '_');
    const outputFilename = `${safeName}.azw3`;
    const outputPath = path.join(booksDir, outputFilename);

    console.log(`Converting ${req.file.originalname}...`);

    execFile("/usr/bin/ebook-convert", [inputPath, outputPath], (error, stdout, stderr) => {
        fs.unlinkSync(inputPath); // Delete temp file
        
        if (error) {
            console.error("Conversion failed:", stderr);
            return res.status(500).send("Conversion Failed. Check logs.");
        }
        res.redirect("/admin");
    });
});

// 5. Delete Book
app.post("/delete", isAuthenticated, (req, res) => {
    const bookName = req.body.filename;
    // Basic path traversal protection
    if (bookName.includes("/") || bookName.includes("..")) return res.status(400).send("Invalid filename");

    const filePath = path.join(booksDir, bookName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    res.redirect("/admin");
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});