# Macarrão Dellas

Site de pedidos com cardápio público, painel de gestão e API. O projeto roda com vinext/Vite e publica no Cloudflare Workers.

## Requisitos

- Node.js 22.13 ou superior
- npm

## Executar localmente

    npm ci
    npm run dev

Para testar o Worker compilado, gere o build e inicie o preview local:

    npm run build
    npm run start

### Banco D1 local

As APIs de catálogo e pedidos precisam das tabelas D1. Depois de gerar o build, aplique as migrações no banco local (não remoto):

    npm run build
    npx wrangler d1 execute site-creator-d1 --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_far_firebrand.sql
    npx wrangler d1 execute site-creator-d1 --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_cuddly_amphibian.sql

Execute cada migração uma vez por banco local novo. Em seguida, use `npm run dev` ou `npm run start`.

## Comandos

- `npm run build`: compila o site para publicação.
- `npm run start`: serve localmente o build pelo runtime do Cloudflare Workers; requer `npm run build`.
- `npm run lint`: verifica o código com ESLint.
- `npm test`: executa os testes unitários de horários, telefone e autenticação.
- `npm run auth:setup`: configura credenciais aleatórias para o preview local, sem sobrescrever arquivos existentes.
- `npm run db:generate`: gera migrações após alterar o esquema do banco.

## Validação

Os testes unitários cobrem a lógica de horário em `America/Fortaleza`, inclusive virada de dia e abertura manual, além da validação de WhatsApp. Use `npm test`, `npm run lint` e `npm run build` para validar o código.

## Funcionamento e pedidos

Os horários semanais e o modo manual (automático, aberto ou fechado) ficam salvos no catálogo do D1. O site consulta o estado calculado no servidor usando o fuso `America/Fortaleza`; a API de pedidos repete a validação de funcionamento e disponibilidade dos produtos. O WhatsApp do cliente é obrigatório para qualquer pedido.

Os pedidos são gravados no D1 antes de oferecer a abertura do WhatsApp. Se não for possível abrir o aplicativo, o cliente pode tentar novamente pelo link exibido sem registrar outro pedido.

O gestor usa login próprio por e-mail e senha, com cookie de sessão assinado e protegido (`HttpOnly`, `SameSite=Strict` e `Secure` em HTTPS). A senha é derivada com PBKDF2 e não fica armazenada em texto puro. O acesso à página e às APIs administrativas exige uma sessão válida; o catálogo e o acompanhamento público de pedidos continuam públicos conforme necessário.

### Configurar o acesso local ao gestor

Na primeira configuração local, execute:

    npm run auth:setup

O comando adiciona a `.dev.vars` (ignorado pelo Git) o hash da senha e uma chave de sessão aleatória, sem substituir outras configurações. Ele mostra uma senha inicial uma única vez no terminal. Guarde-a em um gerenciador de senhas. Se as entradas `GESTOR_*` já existirem, o comando não as sobrescreve. Depois, inicie ou reinicie o preview:

    npm run build
    npm run start

Abra `/gestor` e entre com `rafaele.nascimento93@gmail.com` e a senha exibida pelo comando. A sessão expira após 12 horas; use **Sair** para encerrá-la no navegador. Para redefinir a senha local, remova somente as três entradas `GESTOR_*` de `.dev.vars` e execute `npm run auth:setup` novamente.

O comando configura somente o ambiente local. Antes de publicar, configure no Cloudflare os segredos `GESTOR_EMAIL`, `GESTOR_PASSWORD_HASH` e `GESTOR_SESSION_SECRET` com valores próprios; não publique `.dev.vars` nem compartilhe senhas. Configure também limitação de requisições para o endpoint de login na borda do Cloudflare.

## Pastas e arquivos

- `app/`: rotas da API, autenticação e páginas do gestor.
- `public/cardapio.html`: cardápio e montagem dos pedidos.
- `public/assets/`: imagens e recursos visuais.
- `db/`: esquema e acesso tipado ao banco D1.
- `drizzle/`: migrações SQL do banco.
- `worker/`: entrada do Cloudflare Worker.
- `build/` e `vite.config.ts`: empacotamento e configuração da publicação.
- `.openai/hosting.json`: configura a publicação e vincula o D1 `DB`.

## Banco de dados

O site está configurado para Cloudflare D1, um banco SQLite gerenciado. `db/schema.ts` define as tabelas `orders` (pedidos e acompanhamento) e `settings` (catálogo, horários e disponibilidade). As rotas em `app/api/` leem e gravam esses dados. As migrações necessárias estão em `drizzle/`.

## Gestor

O painel fica em `/gestor`. A autenticação e as permissões de edição são verificadas no código do gestor e nas rotas da API.
\n