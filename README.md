# Faction Duels · Administração

Site do administrador do Faction Duels. Fica publicado pelo GitHub Pages em
https://jonimendes90.github.io/faction-duels-admin/

## O que tem
- **Métricas:** jogadores ativos, contas novas, retenção (dia seguinte e 7 dias), partidas, desistências, duração, vitória por facção, Comandante e carta, economia.
- **Bots:** os 200 perfis com % de vitória (partidas reais e simulação), alerta de forte/fraco demais e botão para tirar um bot do matchmaking.
- **Cartas:** buffs e nerfs de atributos e custo de habilidade, sem atualizar o app.
- **Eventos:** ouro ou XP multiplicados por tempo limitado.
- **Notícias** e **Prêmios** (caixa de prêmios no jogo, para todos ou para um jogador).
- **Versões:** escolhe qual versão do jogo os apps baixam e a versão mínima do app.
- **Jogador:** busca uma conta pelo e-mail.

## Segurança
O site é público, mas não funciona sem login de uma conta marcada como administradora no banco (tabela `admins`).
Todas as permissões são conferidas no Supabase. Aqui só existe a chave pública do projeto, a mesma que vai dentro do jogo.

## Arquivos
- `index.html`, `style.css`, `app.js`: o site.
- `data/catalog.json`: cópia das cartas, Comandantes, equipamentos e bots (o site usa a versão mais nova do servidor quando existe).
- `data/sim-bots.json`: resultado da simulação dos bots (gerado por `scripts/simbots_all.js` no repositório do jogo).
