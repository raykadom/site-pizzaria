// URL base da API
const API = '/api';

// Cache local de pizzas e clientes
let cPizzas   = [];
let cClientes = [];

// Recupera token e usuário do localStorage (se existir)
let TOKEN          = localStorage.getItem('pz_token') || '';
let USUARIO_LOGADO = JSON.parse(localStorage.getItem('pz_usuario') || 'null');

// Variável usada no fechamento de mesas
let mesaEmFechamento = null;

// ================= LOGIN =================
async function fazerLogin() {
  // Captura valores do formulário
  const email = document.getElementById('l-email').value.trim();
  const senha = document.getElementById('l-senha').value;  
  const btn   = document.getElementById('btn-login');
  const erro  = document.getElementById('login-erro');

  // Validação básica
  if (!email || !senha) {
    erro.style.display = 'block';
    erro.textContent   = 'Preencha e-mail e senha.';
    return;
  }

  // Feedback visual no botão
  btn.disabled    = true;
  btn.textContent = 'Entrando...';
  erro.style.display = 'none';

  try {
    // Requisição de login
    const res  = await fetch(API + '/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, senha }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'Credenciais inválidas');

    // Salva token e usuário
    TOKEN = data.token;
    USUARIO_LOGADO = data.usuario;
    localStorage.setItem('pz_token', TOKEN);
    localStorage.setItem('pz_usuario', JSON.stringify(data.usuario));

    // Aplica regras de perfil
    aplicarPerfil(data.usuario);
    document.body.classList.add('logado');

  } catch (e) {
    // Exibe erro
    erro.style.display = 'block';
    erro.textContent   = e.message;
  } finally {
    // Restaura botão
    btn.disabled    = false;
    btn.textContent = 'Entrar';
  }
}

// ================= LOGOUT =================
function sair() {
  TOKEN = '';
  USUARIO_LOGADO = null;

  // Limpa dados do navegador
  localStorage.removeItem('pz_token');
  localStorage.removeItem('pz_usuario');

  // Atualiza UI
  document.body.classList.remove('logado');
  document.getElementById('l-senha').value = '';
}

// Se já estiver logado ao abrir a página
if (TOKEN && USUARIO_LOGADO) {
  aplicarPerfil(USUARIO_LOGADO);
  document.body.classList.add('logado');
}

// ================= UTILITÁRIOS =================

// Exibe mensagem toast
function toast(msg, tipo = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `show ${tipo}`;
  setTimeout(() => el.className = '', 3000);
}

// Abre modal
function abrir(id)  { document.getElementById(id).classList.add('open'); }

// Fecha modal
function fechar(id) { document.getElementById(id).classList.remove('open'); }

// Fecha modal ao clicar fora
document.querySelectorAll('.modal-bg').forEach(bg =>
  bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); })
);

// Formata moeda em Real
function R$(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}

// Retorna badge de status
function badge(s) {
  const r = {
    recebido:     '📥 Recebido',
    em_preparo:   '👨‍🍳 Em Preparo',
    saiu_entrega: '🛵 Saiu p/ Entrega',
    entregue:     '✅ Entregue',
    cancelado:    '❌ Cancelado',
  };
  return `<span class="badge b-${s}">${r[s] || s}</span>`;
}

// ================= API GENERICA =================
async function api(method, url, body) {
  const opts = {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${TOKEN}`, // envia token
    },
  };

  if (body) opts.body = JSON.stringify(body);

  const res  = await fetch(API + url, opts);
  const data = await res.json();

  // Se token expirou
  if (res.status === 401) { 
    sair(); 
    throw new Error('Sessão expirada'); 
  }

  // Tratamento de erro
  if (!res.ok) throw new Error(data.erro || 'Erro na requisição');

  return data;
}

// ================= PERFIL =================
function aplicarPerfil(usuario) {
  // Preenche sidebar
  document.getElementById('sb-nome').textContent   = usuario.nome;
  document.getElementById('sb-perfil').textContent = usuario.perfil;

  const perfil  = usuario.perfil;
  const isAdmin = perfil === 'Administrador';
  const isGar   = perfil === 'Garcom';

  // Funções auxiliares de exibição
  function show(id, visible, type = 'flex') {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? type : 'none';
  }

  function showEl(el, visible, type = 'flex') {
    if (el) el.style.display = visible ? type : 'none';
  }

  // Controle de acesso por perfil
  show('menu-usuarios',   isAdmin, 'block');
  show('btn-usuarios',    isAdmin, 'flex');
  show('sb-group-garcom', isGar,   'block');
  show('btn-nav-mesas',   isGar,   'flex');

  // Garçom não vê essas telas
  showEl(document.querySelector('[onclick*="clientes"]'),  !isGar);
  showEl(document.querySelector('[onclick*="pedidos"]'),   !isGar);
  showEl(document.querySelector('[onclick*="dashboard"]'), !isGar);

  // Redireciona automaticamente
  if (isGar) {
    ir('mesas', document.getElementById('btn-nav-mesas'));
  } else {
    ir('dashboard', document.querySelector('[onclick*="dashboard"]'));
  }
}

// ================= MESAS =================
// (Aqui você já tem um sistema bem avançado de controle de mesas)
// Carrega pedidos por garçom e organiza por mesa
async function carregarMesas(mesaFiltro = null) {
  const grid = document.getElementById('grid-mesas');

  // Mostra loading
  grid.innerHTML = '<div class="spin-wrap"><div class="spin"></div> Carregando...</div>';

  try {
    // Busca pedidos do garçom logado
    const pedidos = await api('GET', `/pedidos?garcom=${USUARIO_LOGADO.id}`);

    // Filtra pedidos ativos
    const ativos = pedidos.filter(p => !['entregue','cancelado'].includes(p.status));

    // Se não tiver pedidos
    if (!ativos.length) {
      grid.innerHTML = `<div class="empty">Nenhum pedido ativo</div>`;
      return;
    }

    // Agrupa por mesa
    const porMesa = {};
    ativos.forEach(p => {
      const key = p.mesa || 'balcão';
      if (!porMesa[key]) porMesa[key] = [];
      porMesa[key].push(p);
    });

    // Renderiza cards de mesas
    grid.innerHTML = Object.entries(porMesa).map(([mesa, peds]) => {
      const total = peds.reduce((s, p) => s + (p.total || 0), 0);

      return `
        <div class="mesa-card">
          <div class="mesa-num">Mesa ${mesa}</div>
          <div>Total: ${R$(total)}</div>
        </div>`;
    }).join('');

  } catch (e) {
    grid.innerHTML = `<div class="empty">${e.message}</div>`;
  }
}

// ================= PEDIDOS =================
// Criação de pedido comum (delivery/balcão)
async function salvarPedido() {
  const cliId = document.getElementById('ped-cli').value;

  // Validação
  if (!cliId) { 
    toast('Selecione um cliente', 'err'); 
    return; 
  }

  const itens = [];

  // Monta lista de itens
  document.querySelectorAll('#itens-lista .item-row').forEach(row => {
    itens.push({
      pizza:      row.querySelector('.ip').value,
      tamanho:    row.querySelector('.it').value,
      quantidade: parseInt(row.querySelector('.iq').value) || 1,
    });
  });

  if (!itens.length) {
    toast('Adicione itens', 'err'); 
    return;
  }

  try {
    // Envia pedido
    await api('POST', '/pedidos', {
      cliente: cliId,
      itens
    });

    toast('Pedido criado!');
    fechar('m-pedido');
    carregarPedidos();

  } catch (e) {
    toast('Erro: ' + e.message, 'err');
  }
}

// ================= USUÁRIOS =================
async function salvarUsuario() {
  const nome  = document.getElementById('u-nome').value.trim();
  const email = document.getElementById('u-email').value.trim();
  const senha = document.getElementById('u-senha').value;

  // Validação
  if (!nome || !email || !senha) { 
    toast('Preencha todos os campos', 'err'); 
    return; 
  }

  try {
    // Cria usuário
    await api('POST', '/usuarios', {
      nome, email, senha,
      perfil: document.getElementById('u-perfil').value,
    });

    toast('Usuário criado!');
    fechar('m-usuario');
    carregarUsuarios();

  } catch (e) { 
    toast('Erro: ' + e.message, 'err'); 
  }
}