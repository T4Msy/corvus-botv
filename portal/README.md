# API do Corvus para o portal

O portal usa esta API para mandar lembretes num grupo do WhatsApp pelo Corvus.

> ⚠️ **A porta 3000 ainda está fechada.** Por enquanto a API só responde de dentro
> do servidor. Para o portal conseguir chamá-la, é preciso liberar a porta 3000 no
> firewall do servidor (iptables) e na Security List da Oracle.

## Endereço

```
http://163.176.188.246:3000
```

## Token (senha)

O token está em **`portal/token.txt`**. Esse arquivo fica fora do git, porque o
repositório é público. No servidor ele fica em `API_TOKEN`, no `.env`.

Mande o token em **toda** chamada, neste cabeçalho:

```
Authorization: Bearer <token>
```

Guarde o token **no servidor do portal**, nunca no JavaScript da página: quem
abrir o código-fonte do site veria o token.

## Rotas

| Método | Rota      | O que faz                                    |
|--------|-----------|----------------------------------------------|
| GET    | `/status` | `{ "conectado": true }` se o bot está online |
| GET    | `/grupos` | Lista os grupos do bot (id, nome, membros)   |
| GET    | `/membros`| Números que podem receber no privado         |
| POST   | `/enviar` | Envia a mensagem num grupo ou no privado     |

### POST /enviar

Corpo em JSON:

```json
{
  "grupo": "120363431559282902@g.us",
  "mensagem": "📚 Nova atividade no portal: Trabalho de História, entrega 05/11"
}
```

- `grupo` é o id do grupo, que termina em `@g.us`. Pode ser omitido se
  `API_DEFAULT_GROUP` estiver definido no `.env` do servidor.
- `mensagem` aceita até 4000 caracteres. A formatação do WhatsApp funciona:
  `*negrito*`, `_itálico_`.

Resposta de sucesso: `{ "ok": true, "id": "..." }`

### Envio no privado

Troque `grupo` por `numero`, com DDI e DDD. Tanto faz mandar com ou sem o 9:

```json
{ "numero": "5534999999999", "mensagem": "Sua atividade vence amanhã!" }
```

Regras:
- **Só membros da Masayoshi 🍷** recebem. Isso é definido por `API_DM_GROUP` e
  conferido na hora do envio: quem sai do grupo deixa de receber, e quem entra
  passa a receber.
- **Uma mensagem a cada 5 segundos.** Se tentar antes disso, a API responde 429.
  Mande uma mensagem por vez, não uma lista inteira.

### Erros

Em caso de erro, a resposta é `{ "erro": "..." }`, com um destes códigos:

| Código | Motivo                                           |
|--------|--------------------------------------------------|
| 400    | Falta o grupo ou a mensagem, ou o JSON é inválido |
| 401    | Token errado                                     |
| 403    | Número fora da Masayoshi (envio no privado)      |
| 404    | O bot não está nesse grupo                       |
| 429    | Mais de 20 envios no mesmo minuto, ou menos de 5 s entre mensagens no privado |
| 503    | O bot está desconectado do WhatsApp              |

## Grupos atuais

| Grupo              | id                              |
|--------------------|---------------------------------|
| teste corvus       | `120363431559282902@g.us`       |
| MSY - DIRETORIA    | `120363317768584868@g.us`       |
| Masayoshi 🍷        | `553493181512-1629215863@g.us`  |

## Exemplos

### Node.js, no servidor do portal

```js
async function enviarLembrete (texto) {
  const res = await fetch('http://163.176.188.246:3000/enviar', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CORVUS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ grupo: '120363431559282902@g.us', mensagem: texto })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.erro)
  return data
}
```

### PHP

```php
$ch = curl_init('http://163.176.188.246:3000/enviar');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer ' . getenv('CORVUS_TOKEN'),
    'Content-Type: application/json'
  ],
  CURLOPT_POSTFIELDS => json_encode([
    'grupo' => '120363431559282902@g.us',
    'mensagem' => '📚 Nova atividade no portal!'
  ])
]);
$resposta = curl_exec($ch);
```

### Testar pelo terminal

```bash
curl -X POST http://163.176.188.246:3000/enviar \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grupo":"120363431559282902@g.us","mensagem":"teste do portal"}'
```
