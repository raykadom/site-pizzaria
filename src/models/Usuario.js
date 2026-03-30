// Importa funções de acesso ao banco (SQLite) e garante que ele esteja pronto
const { ready, query, run, get } = require('../database/sqlite');

// Biblioteca para criptografia de senha
const bcrypt = require('bcryptjs');

/**
 * Função auxiliar para formatar o usuário vindo do banco
 * Converte os campos para um padrão mais amigável (ex: ativo booleano)
 */
function formatarUsuario(row) {
  if (!row) return null;

  return {
    _id:       row.id,               // compatibilidade (ex: frontend)
    id:        row.id,               // id principal
    nome:      row.nome,             // nome do usuário
    email:     row.email,            // email
    perfil:    row.perfil,           // perfil (Admin, Atendente, etc)
    ativo:     row.ativo === 1,      // converte 1/0 para true/false
    createdAt: row.created_at,       // data de criação
    updatedAt: row.updated_at,       // data de atualização
  };
}

// Objeto que representa o "model" de usuário
const Usuario = {

  /**
   * Busca todos os usuários
   */
  async findAll() {
    await ready; // garante que o banco está carregado

    const rows = query(`
      SELECT id, nome, email, perfil, ativo, created_at, updated_at
      FROM usuarios ORDER BY created_at DESC
    `);

    // Converte todos os registros usando a função de formatação
    return rows.map(formatarUsuario);
  },

  /**
   * Busca usuário pelo email (usado no login)
   */
  async findByEmail(email) {
    await ready;

    return get(
      'SELECT * FROM usuarios WHERE email = ?',
      [email.toLowerCase().trim()] // normaliza o email
    );
  },

  /**
   * Busca usuário pelo ID
   */
  async findById(id) {
    await ready;

    const row = get(`
      SELECT id, nome, email, perfil, ativo, created_at, updated_at
      FROM usuarios WHERE id = ?
    `, [id]);

    return formatarUsuario(row);
  },

  /**
   * Cria um novo usuário
   */
  async create({ nome, email, senha, perfil = 'Atendente' }) {
    await ready;

    // Criptografa a senha antes de salvar
    const hash = await bcrypt.hash(senha, 10);

    const info = run(
      'INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      [
        nome.trim(),                 // remove espaços extras
        email.toLowerCase().trim(),  // normaliza email
        hash,                        // senha criptografada
        perfil
      ]
    );

    // Retorna o usuário recém criado
    return this.findById(info.lastInsertRowid);
  },

  /**
   * Atualiza um usuário existente
   */
  async update(id, { nome, email, senha, perfil, ativo }) {
    await ready;

    // Busca usuário atual
    const atual = get('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!atual) return null;

    // Mantém senha atual se não for enviada nova
    let senhaFinal = atual.senha;

    // Se enviou nova senha, criptografa
    if (senha) {
      senhaFinal = await bcrypt.hash(senha, 10);
    }

    // Executa update no banco
    run(`
      UPDATE usuarios SET
        nome       = ?,              -- nome atualizado
        email      = ?,              -- email atualizado
        senha      = ?,              -- senha (criptografada)
        perfil     = ?,              -- perfil
        ativo      = ?,              -- status ativo/inativo
        updated_at = datetime('now') -- atualiza data
      WHERE id = ?
    `, [
      nome   ?? atual.nome,                          // mantém se não enviado
      email  ?? atual.email,
      senhaFinal,
      perfil ?? atual.perfil,
      ativo !== undefined ? (ativo ? 1 : 0) : atual.ativo,
      id
    ]);

    // Retorna usuário atualizado
    return this.findById(id);
  },

  /**
   * Remove um usuário do banco
   */
  async delete(id) {
    await ready;

    const info = run('DELETE FROM usuarios WHERE id = ?', [id]);

    // Retorna true se removeu algo
    return info.changes > 0;
  },

  /**
   * Verifica se a senha digitada bate com o hash salvo
   */
  verificarSenha(senhaDigitada, hashSalvo) {
    return bcrypt.compare(senhaDigitada, hashSalvo);
  },
};

// Exporta o model
module.exports = Usuario;
