import express from 'express';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import helmet from 'helmet';
import basicAuth from 'express-basic-auth';
import Database from 'better-sqlite3';
import fs from 'fs';

dotenv.config();

const app = express();
const __dirname = path.resolve();

// Security headers (sane defaults)
app.use(helmet({
  contentSecurityPolicy: false, // keep templates simple
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure DB exists and create table
const dbPath = path.join(__dirname, 'policy_pulse.sqlite');
const db = new Database(dbPath);
db.exec(`
CREATE TABLE IF NOT EXISTS applicants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  first_name TEXT,
  last_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  cellphone TEXT,
  email TEXT,
  licensed_agent INTEGER,
  years_experience TEXT,
  resume_path TEXT,
  resume_original_name TEXT,
  disclaimer_checked INTEGER
);
`);

// Multer config for resume uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});

function fileFilter (req, file, cb) {
  const allowed = ['.pdf', '.doc', '.docx', '.txt', '.rtf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) return cb(null, true);
  cb(new Error('Only .pdf, .doc, .docx, .txt, .rtf files are allowed'));
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

app.get('/', (req, res) => {
  res.render('index', { baseUrl: process.env.BASE_URL || '' });
});

app.post('/submit', upload.single('resume'), (req, res) => {
  try {
    const {
      first_name, last_name, address, city, state, zip,
      cellphone, email, licensed_agent, years_experience, disclaimer
    } = req.body;

    if (!first_name || !last_name || !email || !cellphone) {
      return res.status(400).send('Missing required fields');
    }
    if (disclaimer !== 'on') {
      return res.status(400).send('You must acknowledge the background check disclosure.');
    }

    const stmt = db.prepare(`INSERT INTO applicants 
      (first_name, last_name, address, city, state, zip, cellphone, email, licensed_agent, years_experience, resume_path, resume_original_name, disclaimer_checked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    let resumePath = null, resumeOriginal = null;
    if (req.file) {
      resumePath = '/uploads/' + req.file.filename;
      resumeOriginal = req.file.originalname;
    }

    stmt.run(
      first_name, last_name, address, city, state, zip,
      cellphone, email,
      licensed_agent === 'on' ? 1 : 0,
      years_experience || '',
      resumePath, resumeOriginal,
      1
    );

    res.render('thanks', { firstName: first_name });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error saving your application.');
  }
});

// Basic-auth-protected admin
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPass = process.env.ADMIN_PASS || 'changeme';
app.use('/admin', basicAuth({
  users: { [adminUser]: adminPass },
  challenge: true,
  realm: 'PolicyPulseAdmin'
}));

app.get('/admin', (req, res) => {
  const rows = db.prepare('SELECT * FROM applicants ORDER BY created_at DESC').all();
  res.render('admin', { rows, baseUrl: process.env.BASE_URL || '' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Policy Pulse app listening on port ${PORT}`));
