// importa a biblioteca jsonwebtoken para trabalhar com JWT
const jwt = require('jsonwebtoken');


// middleware de autenticação
function autenticar(req, res, next) {
  // pega o header "Authorization" da requisição
  const authHeader = req.headers['authorization'];

  // extrai o token (formato esperado: "Bearer TOKEN")
  const token = authHeader && authHeader.split(' ')[1];


  // se não houver token, retorna erro 401 (não autorizado)
  if (!token) {
    return res.status(401).json({ erro: 'Token não fornecido. Faça login.' });
  }


  try {
    // verifica e decodifica o token usando a chave secreta
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // armazena os dados do usuário no objeto da requisição
    req.usuario = payload;

    // chama o próximo middleware ou rota
    next();
  } catch (erro) {
    // se o token for inválido ou expirado, retorna erro 401
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}


// exporta o middleware para ser usado em outras partes da aplicação
module.exports = autenticar;

