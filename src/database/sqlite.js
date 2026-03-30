// Importa o sql.js (SQLite que roda em memória/JS)
const initSqlJs = require('sql.js');

// Módulo nativo para manipular arquivos
const fs = require('fs');

// Módulo para lidar com caminhos de arquivos
const path = require('path');

// Define o caminho do banco:
// usa variável de ambiente DB_PATH ou cria "pizzaria.db" na raiz do projeto
const DB_PATH = process.env.DB_PATH
  || path.join(__dirname, '..', '..', 'pizzaria.db');

// Estado global da aplicação (onde ficará o banco em memória)
const state = { db: null };

// Promise que inicializa o banco (async)
const ready = (async () => {

  // Inicializa o SQL.js (carrega engine SQLite)
  const SQL = await initSqlJs();

  // Se o arquivo do banco já existir...
  if (fs.existsSync(DB_PATH)) {

    // Lê o arquivo do banco em buffer
    const fileBuffer = fs.readFileSync(DB_PATH);

    // Carrega o banco existente em memória
    state.db = new SQL.Database(fileBuffer);

  } else {

    // Se não existir, cria um banco vazio em memória
    state.db = new SQL.Database();
  }

  const db = state.db;

  // Ativa suporte a foreign keys (relacionamentos)
  db.run('PRAGMA foreign_keys = ON');

  // =========================
  // TABELA: USUÁRIOS
  // =========================
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id          INTEGER PRIMARY KEY AUTOINCREMENT, // ID único
      nome        TEXT    NOT NULL,                  // Nome do usuário
      email       TEXT    NOT NULL UNIQUE,           // Email único
      senha       TEXT    NOT NULL,                  // Senha (hash)
      perfil      TEXT    NOT NULL DEFAULT 'Atendente', // Perfil (Admin, Garçom, etc)
      ativo       INTEGER NOT NULL DEFAULT 1,        // Status ativo/inativo
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')), // Data criação
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))  // Data atualização
    )
  `);

  // =========================
  // TABELA: CLIENTES
  // =========================
  db.run(`
    CREATE TABLE IF NOT EXISTS clientes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nome        TEXT    NOT NULL,
      telefone    TEXT    NOT NULL,
      endereco    TEXT    NOT NULL DEFAULT '{}', // JSON com dados de endereço
      observacoes TEXT    NOT NULL DEFAULT '',
      ativo       INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // =========================
  // TABELA: PIZZAS
  // =========================
  db.run(`
    CREATE TABLE IF NOT EXISTS pizzas (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      nome         TEXT    NOT NULL,
      descricao    TEXT    NOT NULL DEFAULT '',
      ingredientes TEXT    NOT NULL,
      precos       TEXT    NOT NULL DEFAULT '{"P":0,"M":0,"G":0}', // JSON com preços
      disponivel   INTEGER NOT NULL DEFAULT 1, // Disponível ou não
      categoria    TEXT    NOT NULL DEFAULT 'tradicional',
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // =========================
  // TABELA: PEDIDOS
  // =========================
  db.run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_pedido   INTEGER, // Número sequencial do pedido
      cliente_id      INTEGER NOT NULL REFERENCES clientes(id), // FK cliente
      subtotal        REAL    NOT NULL DEFAULT 0,
      taxa_entrega    REAL    NOT NULL DEFAULT 0,
      total           REAL    NOT NULL DEFAULT 0,
      forma_pagamento TEXT    NOT NULL,
      troco           REAL    NOT NULL DEFAULT 0,
      status          TEXT    NOT NULL DEFAULT 'recebido', // Status do pedido
      observacoes     TEXT    NOT NULL DEFAULT '',
      mesa            INTEGER, // Número da mesa (se for consumo local)
      origem          TEXT    NOT NULL DEFAULT 'balcao', // mesa ou balcão
      garcom_id       INTEGER REFERENCES usuarios(id), // FK garçom
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // =========================
  // TABELA: ITENS DO PEDIDO
  // =========================
  db.run(`
    CREATE TABLE IF NOT EXISTS itens_pedido (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id      INTEGER NOT NULL REFERENCES pedidos(id), // FK pedido
      pizza_id       INTEGER NOT NULL REFERENCES pizzas(id),  // FK pizza
      nome_pizza     TEXT    NOT NULL, // Nome salvo no momento do pedido
      tamanho        TEXT    NOT NULL, // P, M ou G
      quantidade     INTEGER NOT NULL DEFAULT 1,
      preco_unitario REAL    NOT NULL DEFAULT 0,
      subtotal       REAL    NOT NULL DEFAULT 0
    )
  `);

  // Salva o banco no arquivo físico
  salvar();

  console.log('SQLite (sql.js) conectado:', DB_PATH);

  // Retorna a instância do banco
  return db;

})();

// Função que salva o banco em memória no arquivo .db
function salvar() {
  if (!state.db) return;

  // Exporta o banco para binário
  const data = state.db.export();

  // Escreve no arquivo
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Executa uma query SELECT e retorna vários resultados
function query(sql, params = []) {
  const stmt = state.db.prepare(sql);
  const results = [];

  // Passa parâmetros para a query
  stmt.bind(params);

  // Itera linha por linha
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }

  // Libera memória do statement
  stmt.free();

  return results;
}

// Executa INSERT, UPDATE ou DELETE
function run(sql, params = []) {
  state.db.run(sql, params);

  // Busca metadados da operação
  const meta = query('SELECT last_insert_rowid() as id, changes() as changes');

  // Salva no arquivo após alteração
  salvar();

  return {
    lastInsertRowid: meta[0]?.id, // último ID inserido
    changes: meta[0]?.changes,    // quantidade de linhas afetadas
  };
}

// Retorna apenas um registro (ou null)
function get(sql, params = []) {
  const rows = query(sql, params);
  return rows[0] || null;
}

// Exporta funções para uso no resto do sistema
module.exports = { ready, query, run, get, salvar };