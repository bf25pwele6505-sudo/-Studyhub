const express = require('express');
const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
const cors = require('cors');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_ROOT = process.env.STUDYHUB_DATA_DIR
  ? path.resolve(process.env.STUDYHUB_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_ROOT, 'data.json');
const DB_FILE = path.join(DATA_ROOT, 'studyhub.db');
const BACKUP_DIR = path.join(DATA_ROOT, 'backups');
const MAX_BACKUPS = 20;
const DEFAULT_DATA = {
  semesters: [],
  overall_gpa: 0,
  profile: {
    name: '',
    father_name: '',
    registration_no: '',
    section: '',
    department: ''
  }
};

let db;

app.use(cors());
app.use(express.json());
// Serve static files from project root so site works when server runs
app.use(express.static(path.join(__dirname, '..')));

async function readData(){
  const row = db
    .prepare('SELECT value FROM app_kv WHERE key = ?')
    .get('studyhub_data');

  if(!row || typeof row.value !== 'string'){
    return {...DEFAULT_DATA};
  }

  try{
    const parsed = JSON.parse(row.value);
    return parsed && typeof parsed === 'object'
      ? parsed
      : {...DEFAULT_DATA};
  }catch(err){
    return {...DEFAULT_DATA};
  }
}

async function writeData(obj){
  const payload = JSON.stringify(obj, null, 2);
  const now = new Date().toISOString();
  db.prepare(
    `
      INSERT INTO app_kv(key, value, updated_at)
      VALUES(?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `
  ).run('studyhub_data', payload, now);

  await createDatabaseBackup('write');
}

async function ensureDataFile(){
  try{
    await fs.access(DATA_FILE);
  }catch(err){
    await fs.mkdir(path.dirname(DATA_FILE), {recursive: true});
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');
  }

  // If the file exists but has invalid JSON, reset to a known-good structure.
  try{
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    JSON.parse(raw);
  }catch(err){
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');
  }
}

async function ensureDatabase(){
  await fs.mkdir(path.dirname(DB_FILE), {recursive: true});
  await fs.mkdir(BACKUP_DIR, {recursive: true});

  db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = FULL;');

  db.prepare(
    `
      CREATE TABLE IF NOT EXISTS app_kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `
  ).run();

  const row = db
    .prepare('SELECT key FROM app_kv WHERE key = ?')
    .get('studyhub_data');

  if(!row){
    const seed = await loadSeedData();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO app_kv(key, value, updated_at) VALUES(?, ?, ?)'
    ).run('studyhub_data', JSON.stringify(seed, null, 2), now);
    await createDatabaseBackup('init');
  }
}

async function loadSeedData(){
  try{
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if(parsed && typeof parsed === 'object'){
      return parsed;
    }
  }catch(err){
    // Ignore and use defaults.
  }

  return {...DEFAULT_DATA};
}

function makeBackupName(reason){
  const now = new Date().toISOString().replace(/[.:]/g, '-');
  return `studyhub-${reason}-${now}.db`;
}

async function createDatabaseBackup(reason){
  if(!fssync.existsSync(DB_FILE)){
    return;
  }

  const fileName = makeBackupName(reason);
  const destination = path.join(BACKUP_DIR, fileName);
  await fs.copyFile(DB_FILE, destination);
  await pruneBackups();
}

async function pruneBackups(){
  const names = await fs.readdir(BACKUP_DIR);
  const dbBackups = names
    .filter(name => name.endsWith('.db'))
    .sort();

  if(dbBackups.length <= MAX_BACKUPS){
    return;
  }

  const toDelete = dbBackups.slice(0, dbBackups.length - MAX_BACKUPS);
  await Promise.all(
    toDelete.map(name => fs.unlink(path.join(BACKUP_DIR, name)))
  );
}

function parseSemesterId(rawId){
  const id = Number.parseInt(rawId, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function toNonNegativeNumber(value){
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeProfile(profile){
  const value = profile && typeof profile === 'object' ? profile : {};
  const safeString = input => typeof input === 'string' ? input.trim() : '';
  return {
    name: safeString(value.name),
    father_name: safeString(value.father_name),
    registration_no: safeString(value.registration_no),
    section: safeString(value.section),
    department: safeString(value.department)
  };
}

function normalizeTextItems(items){
  if(!Array.isArray(items)) return [];
  return items
    .map(item => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean);
}

function normalizeResourceItem(resource, allowVideo){
  if(!resource || typeof resource !== 'object') return null;
  const allowedTypes = allowVideo
    ? ['pdf', 'document', 'video', 'link']
    : ['pdf', 'document', 'link'];
  const type = typeof resource.type === 'string' ? resource.type.trim().toLowerCase() : 'link';
  const safeType = allowedTypes.includes(type) ? type : 'link';
  const title = typeof resource.title === 'string' ? resource.title.trim() : '';
  const url = typeof resource.url === 'string' ? resource.url.trim() : '';
  if(!title || !url) return null;

  return {
    source: resource.source === 'file' ? 'file' : 'link',
    type: safeType,
    title,
    url,
    fileName: typeof resource.fileName === 'string' ? resource.fileName.trim() : ''
  };
}

function normalizeStructuredEntries(entries, legacyItems){
  const normalizedEntries = Array.isArray(entries)
    ? entries
        .map(entry => {
          if(!entry || typeof entry !== 'object') return null;
          const title = typeof entry.title === 'string' ? entry.title.trim() : '';
          if(!title) return null;
          const resources = Array.isArray(entry.resources)
            ? entry.resources
                .map(resource => normalizeResourceItem(resource, true))
                .filter(Boolean)
            : [];
          return { title, resources };
        })
        .filter(Boolean)
    : [];

  if(normalizedEntries.length > 0) {
    return normalizedEntries;
  }

  return normalizeTextItems(legacyItems).map(title => ({
    title,
    resources: []
  }));
}

function normalizeLectures(subject){
  return normalizeStructuredEntries(subject.lectures, subject.notes);
}

app.get('/api/data', async (req, res) => {
  try{
    const data = await readData();
    res.json(data);
  }catch(err){
    console.error('GET /api/data failed', err);
    res.status(500).json({error: 'Failed to read data'});
  }
});

app.put('/api/data', async (req, res) => {
  try{
    const incoming = req.body;
    if(!incoming || typeof incoming !== 'object' || Array.isArray(incoming)){
      return res.status(400).json({error: 'Request body must be a JSON object'});
    }

    const normalized = {
      semesters: Array.isArray(incoming.semesters) ? incoming.semesters : [],
      overall_gpa: toNonNegativeNumber(incoming.overall_gpa),
      profile: normalizeProfile(incoming.profile)
    };

    await writeData(normalized);
    return res.json({ok: true});
  }catch(err){
    console.error('PUT /api/data failed', err);
    return res.status(500).json({error: 'Failed to save data'});
  }
});

app.get('/api/health', (req, res) => {
  res.json({ok: true});
});

app.get('/api/semesters/:id/subjects', async (req, res) => {
  try{
    const id = parseSemesterId(req.params.id);
    if(!id){
      return res.status(400).json({error:'Semester id must be a positive integer'});
    }

    const data = await readData();
    const sem = (data.semesters || []).find(s => s.id === id);
    if(!sem) return res.status(404).json({error:'Semester not found'});
    return res.json({subjects: sem.subjects || []});
  }catch(err){
    console.error('GET /api/semesters/:id/subjects failed', err);
    res.status(500).json({error:'Failed to read subjects'});
  }
});

// Replace the subjects array for a semester
app.post('/api/semesters/:id/subjects', async (req, res) => {
  try{
    const id = parseSemesterId(req.params.id);
    if(!id){
      return res.status(400).json({error:'Semester id must be a positive integer'});
    }

    const incoming = req.body;
    if(!incoming || !Array.isArray(incoming.subjects)){
      return res.status(400).json({error:'Request body must include subjects array'});
    }

    const data = await readData();
    if(!Array.isArray(data.semesters)) data.semesters = [];
    let sem = data.semesters.find(s => s.id === id);
    if(!sem){
      sem = {id, name: `Semester ${id}`, subjects: [], semester_gpa: 0};
      data.semesters.push(sem);
    }

    // Map incoming subjects into a safe structure. Keep any existing keys as necessary.
    sem.subjects = incoming.subjects.map((s, idx) => ({
      code: s.code || `SUBJ${(idx+1).toString().padStart(3,'0')}`,
      name: s.name || `Subject ${idx+1}`,
      credit_hours: toNonNegativeNumber(s.credit_hours),
      contact_hours: toNonNegativeNumber(s.contact_hours),
      final_marks: toNonNegativeNumber(s.final_marks),
      books: Array.isArray(s.books)
        ? s.books
            .map(b => normalizeResourceItem(b, false))
            .filter(Boolean)
        : [],
      lectures: normalizeLectures(s),
      assignments: normalizeStructuredEntries(s.assignments, s.assignments),
      quizzes: normalizeStructuredEntries(s.quizzes, s.quizzes),
      details: s.details || ''
    }));

    await writeData(data);
    res.json({ok:true, subjects: sem.subjects});
  }catch(err){
    console.error('POST /api/semesters/:id/subjects failed', err);
    res.status(500).json({error:'Failed to save subjects'});
  }
});

async function startServer(){
  await ensureDataFile();
  await ensureDatabase();
  app.listen(PORT, ()=>{
    console.log(`StudyHub server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server', err);
  process.exit(1);
});
