const path = require('node:path');
const Database = require('better-sqlite3');

const configuredPath = process.env.DB_PATH ?? './data/agendamento.db';
const dbPath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(__dirname, '..', configuredPath);

const db = new Database(dbPath);

const { count: appointments } = db.prepare('SELECT COUNT(*) as count FROM appointments').get();
const { count: patients } = db.prepare('SELECT COUNT(*) as count FROM patients').get();

db.close();

if (appointments > 0 || patients > 0) {
  console.error(
    `Banco de dados não está limpo após a suite: ${appointments} agendamento(s) e ${patients} paciente(s) residuais.`
  );
  process.exit(1);
}

console.log('Banco de dados limpo: nenhuma massa de teste residual.');
