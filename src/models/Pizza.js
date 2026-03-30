// Importa funções auxiliares do banco SQLite
const { ready, query, run, get } = require('../database/sqlite');

// Função para formatar o objeto retornado do banco para um padrão mais amigável
function formatarPizza(row) {
  if (!row) return null; // Se não existir resultado, retorna null

  return {
    _id:         row.id, // Alias para compatibilidade (ex: Mongo-style)
    id:          row.id,
    nome:        row.nome,
    descricao:   row.descricao,
    ingredientes: row.ingredientes,

    // Converte a string JSON de preços para objeto JS
    precos:      JSON.parse(row.precos || '{"P":0,"M":0,"G":0}'),

    // Converte inteiro (0/1) para booleano
    disponivel:  row.disponivel === 1,

    categoria:   row.categoria,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

// Objeto que representa o "model" de Pizza
const Pizza = {

  // Retorna todas as pizzas ordenadas por categoria e nome
  async findAll() {
    await ready; // Garante que o banco está pronto
    return query('SELECT * FROM pizzas ORDER BY categoria, nome')
      .map(formatarPizza); // Formata cada resultado
  },

  // Busca uma pizza pelo ID
  async findById(id) {
    await ready;
    return formatarPizza(
      get('SELECT * FROM pizzas WHERE id = ?', [id])
    );
  },

  // Cria uma nova pizza no banco
  async create({ 
    nome, 
    descricao = '', 
    ingredientes, 
    precos = {}, 
    disponivel = true, 
    categoria = 'tradicional' 
  }) {
    await ready;

    // Executa o INSERT no banco
    const info = run(
      'INSERT INTO pizzas (nome, descricao, ingredientes, precos, disponivel, categoria) VALUES (?, ?, ?, ?, ?, ?)',
      [
        nome.trim(),              // Remove espaços extras
        descricao.trim(),
        ingredientes.trim(),

        // Garante estrutura padrão de preços
        JSON.stringify({
          P: precos.P || 0,
          M: precos.M || 0,
          G: precos.G || 0
        }),

        disponivel ? 1 : 0, // Converte boolean para inteiro
        categoria
      ]
    );

    // Retorna a pizza recém-criada
    return this.findById(info.lastInsertRowid);
  },

  // Atualiza uma pizza existente
  async update(id, { nome, descricao, ingredientes, precos, disponivel, categoria }) {
    await ready;

    // Busca a pizza atual
    const atual = get('SELECT * FROM pizzas WHERE id = ?', [id]);
    if (!atual) return null; // Se não existir, retorna null

    // Converte preços atuais
    const precosAtuais = JSON.parse(atual.precos || '{"P":0,"M":0,"G":0}');

    // Mescla preços antigos com novos (mantém os que não foram enviados)
    const precosFinal  = precos
      ? {
          P: precos.P ?? precosAtuais.P,
          M: precos.M ?? precosAtuais.M,
          G: precos.G ?? precosAtuais.G
        }
      : precosAtuais;

    // Executa o UPDATE
    run(`
      UPDATE pizzas SET
        nome         = ?,
        descricao    = ?,
        ingredientes = ?,
        precos       = ?,
        disponivel   = ?,
        categoria    = ?,
        updated_at   = datetime('now') -- Atualiza timestamp
      WHERE id = ?
    `, [
      nome         ?? atual.nome,          // Mantém valor antigo se não enviado
      descricao    ?? atual.descricao,
      ingredientes ?? atual.ingredientes,
      JSON.stringify(precosFinal),
      disponivel   !== undefined 
        ? (disponivel ? 1 : 0) 
        : atual.disponivel,
      categoria    ?? atual.categoria,
      id
    ]);

    // Retorna a pizza atualizada
    return this.findById(id);
  },

  // Deleta uma pizza pelo ID
  async delete(id) {
    await ready;

    // Executa o DELETE
    const info = run('DELETE FROM pizzas WHERE id = ?', [id]);

    // Retorna true se algo foi deletado
    return info.changes > 0;
  },
};

// Exporta o model para uso em outras partes do sistema
module.exports = Pizza;