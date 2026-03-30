// carrega variáveis de ambiente do arquivo .env
require('dotenv').config();

// importa dependências principais
const express = require('express'); // Framework web
const cors    = require('cors');    // Permite requisições de outras origens
const path    = require('path');    // Trabalhar com caminhos de arquivos


// cria a aplicação Express
const app  = express();
// Define a porta (usa a do .env ou 3001 como padrão)
const PORT = process.env.PORT || 3001;


// habilita CORS (libera acesso da API para front-end externo)
app.use(cors());

// permite receber JSON no corpo das requisições
app.use(express.json());

// define a pasta "public" como estática (front-end)
app.use(express.static(path.join(__dirname, 'public')));


// ===== importa banco e rotas =====

// ready: Promise que indica quando o banco SQLite está pronto
const { ready } = require('./src/database/sqlite');

// Importa todas as rotas da aplicação
const routes = require('./src/routes/index');


// aguarda o banco estar pronto antes de iniciar o servidor
ready.then(() => {

  // prefixo /api para todas as rotas da aplicação
  app.use('/api', routes);


  // ===== roda de teste =====
  app.get('/teste', (req, res) => {
    res.json({
      mensagem: 'API da Pizzaria funcionando!',
      status: 'online',
      porta: PORT                                                   
    });
  });


  // ===== ROTA FALLBACK (SPA) =====

  // Qualquer rota não encontrada retorna o index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });


  // ===== inicia o servidor =====
  app.listen(PORT, () => {
    console.log('=================================');
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);
    console.log(`Front-end: http://localhost:${PORT}`);
    console.log('=================================');
  });


// Caso ocorra erro ao iniciar o banco
}).catch(err => {
  console.error('Erro ao inicializar banco:', err);

  // Encerra o processo com erro
  process.exit(1);
});