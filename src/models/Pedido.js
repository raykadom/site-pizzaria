// Importa funções do módulo de banco SQLite
// ready: garante que o banco está pronto
// query: retorna múltiplos registros
// run: executa comandos (INSERT, UPDATE, DELETE)
// get: retorna apenas um registro
const { ready, query, run, get } = require('../database/sqlite');


// query base para buscar pedidos com dados do cliente (JOIN)
const SELECT_PEDIDO = `
  SELECT
    p.*,                      // todos os campos da tabela pedidos
    c.nome     AS cliente_nome,
    c.telefone AS cliente_telefone
  FROM pedidos p
  LEFT JOIN clientes c ON c.id = p.cliente_id // junta cliente ao pedido
`;


// função que formata os dados do banco para algo mais organizado
function formatarPedido(row, itens = []) {
  if (!row) return null; // se não existir, retorna null

  return {
    _id:           row.id,
    id:            row.id,
    numeroPedido:  row.numero_pedido,

    // dados do cliente
    cliente: {
      _id:      row.cliente_id,
      id:       row.cliente_id,
      nome:     row.cliente_nome,
      telefone: row.cliente_telefone,
    },

    // lista de itens do pedido
    itens: itens.map(it => ({
      _id:           it.id,
      pizza:         it.pizza_id,
      nomePizza:     it.nome_pizza,
      tamanho:       it.tamanho,
      quantidade:    it.quantidade,
      precoUnitario: it.preco_unitario,
      subtotal:      it.subtotal,
    })),

    // valores do pedido
    subtotal:       row.subtotal,
    taxaEntrega:    row.taxa_entrega,
    total:          row.total,

    // pagamento
    formaPagamento: row.forma_pagamento,
    troco:          row.troco,

    // informações adicionais
    status:         row.status,
    observacoes:    row.observacoes,
    mesa:           row.mesa,
    origem:         row.origem,
    garcom:         row.garcom_id,

    // datas
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}


// objeto principal que representa o "model" do Pedido
const Pedido = {

  // buscar todos os pedidos (opcionalmente filtrando por garçom)
  async findAll({ garcomId } = {}) {
    await ready; // garante que o banco está pronto

    let rows;

    if (garcomId) {
      // busca pedidos de um garçom específico
      rows = query(`${SELECT_PEDIDO} WHERE p.garcom_id = ? ORDER BY p.created_at DESC`, [garcomId]);
    } else {
      // busca todos os pedidos
      rows = query(`${SELECT_PEDIDO} ORDER BY p.created_at DESC`);
    }

    // para cada pedido, busca seus itens
    return rows.map(row => {
      const itens = query('SELECT * FROM itens_pedido WHERE pedido_id = ?', [row.id]);
      return formatarPedido(row, itens); // formata o resultado
    });
  },


  // buscar pedido por ID
  async findById(id) {
    await ready;

    const row = get(`${SELECT_PEDIDO} WHERE p.id = ?`, [id]);
    if (!row) return null;

    // busca itens do pedido
    const itens = query('SELECT * FROM itens_pedido WHERE pedido_id = ?', [id]);

    return formatarPedido(row, itens);
  },


  // criar um novo pedido
  async create({
    clienteId,
    itens,
    taxaEntrega = 0,
    formaPagamento,
    troco = 0,
    observacoes = '',
    mesa = null,
    origem = 'balcao',
    garcomId = null
  }) {
    await ready;

    // importa o model de Pizza
    const Pizza = require('./Pizza');

    let subtotal = 0;
    const itensProcessados = [];

    // processa cada item do pedido
    for (const item of itens) {

      // busca pizza no banco
      const pizza = await Pizza.findById(item.pizza);
      if (!pizza) throw new Error(`Pizza ID ${item.pizza} não encontrada`);

      // define preço com base no tamanho
      const preco   = pizza.precos[item.tamanho] || 0;

      // calcula subtotal do item
      const subItem = preco * item.quantidade;

      subtotal += subItem;

      // armazena item processado
      itensProcessados.push({
        pizzaId:       pizza.id,
        nomePizza:     pizza.nome,
        tamanho:       item.tamanho,
        quantidade:    item.quantidade,
        precoUnitario: preco,
        subtotal:      subItem,
      });
    }

    // calcula o total do pedido
    const total = subtotal + (taxaEntrega || 0);

    // gera o número do pedido 
    const contagem     = get('SELECT COUNT(*) as total FROM pedidos');
    const numeroPedido = (contagem?.total || 0) + 1;

    // insere pedido no banco
    const infoPedido = run(`
      INSERT INTO pedidos
        (numero_pedido, cliente_id, subtotal, taxa_entrega, total,
         forma_pagamento, troco, observacoes, mesa, origem, garcom_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      numeroPedido,
      clienteId,
      subtotal,
      taxaEntrega || 0,
      total,
      formaPagamento,
      troco || 0,
      observacoes,
      mesa,
      origem,
      garcomId
    ]);

    // ID do pedido recém criado
    const pedidoId = infoPedido.lastInsertRowid;

    // insere os itens do pedido
    for (const it of itensProcessados) {
      run(`
        INSERT INTO itens_pedido
          (pedido_id, pizza_id, nome_pizza, tamanho, quantidade, preco_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        pedidoId,
        it.pizzaId,
        it.nomePizza,
        it.tamanho,
        it.quantidade,
        it.precoUnitario,
        it.subtotal
      ]);
    }

    // retorna pedido completo
    return this.findById(pedidoId);
  },


  // atualizar status do pedido (ex: pendente > entregue)
  async updateStatus(id, status) {
    await ready;

    const info = run(
      "UPDATE pedidos SET status = ?, updated_at = datetime('now') WHERE id = ?",
      [status, id]
    );

    // se atualizou, retorna pedido atualizado
    return info.changes > 0 ? this.findById(id) : null;
  },


  // deletar pedido
  async delete(id) {
    await ready;

    // remove primeiro os itens (evita erro de chave estrangeira)
    run('DELETE FROM itens_pedido WHERE pedido_id = ?', [id]);

    // remove o pedido
    const info = run('DELETE FROM pedidos WHERE id = ?', [id]);

    return info.changes > 0; // retorna true se deletou
  },
};


// Exporta o model Pedido
module.exports = Pedido;
