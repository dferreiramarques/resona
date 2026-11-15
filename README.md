# RESONA — Ambient Resynthesis

App web (PWA) que transforma o som da sala em música ambiente: ouve o microfone e usa-o para modular uma camada sintetizada, com filtros e reverberação. Também aceita um ficheiro .wav como fonte.

## Usar

Abre o `index.html` num browser recente (HTTPS ou localhost) e carrega em **ligar**. O microfone predefinido abre automaticamente.

- **Constelação**: cada nó é uma luz; arrastar à volta dele funciona como pad XY sobre dois parâmetros (↔ X, ↕ Y). Dá para mexer em vários nós ao mesmo tempo com vários dedos.
- **A distância é tempo**: arrastar o centro de um nó muda-o de sítio, e isso altera o som. A distância vida↔A/B é o ritmo de cada engine (os impulsos de luz que viajam da vida até ao engine são as notas); entrada↔sala é quanto essa entrada é ouvida; grão↔sala é a memória dos grãos; espaço↔saída é o pré-delay da reverb; voz↔sala é a articulação do vocoder; a posição horizontal de A/B é o pan.
- **Deriva**: o nó fica onde o puseres e o canto do ecrã mais próximo define o carácter de todo o synth: superior esquerdo PCM (bitcrush), superior direito FM, inferior esquerdo grão, inferior direito ruído digital; ao centro o som fica limpo. No círculo dele, a direção do ponto é a direção da deriva e a distância ao centro é a velocidade: uma luz-fantasma sai do nó até à borda do ecrã nessa direção e volta, e o som segue-a. Com o ponto ao centro, não há deriva.
- **Várias entradas**: **+ entrada** lista os microfones e interfaces USB ligados; cada entrada é um nó âmbar (X = pan, Y = ganho). Também aceita ficheiros de áudio em loop. Duplo toque no centro de uma entrada (ou o botão no ⚙) liga/desliga-a sem perder a posição nem os valores.
- **Projeção**: **P** (ou ⛶) esconde a interface e põe a constelação em ecrã inteiro. **projetor** abre uma segunda janela, sincronizada em tempo real, para arrastar para o ecrã do projetor.
- **⚙**: escala, tónica, vozes, engines A/B e modo de saída (colunas com anti-eco, ou auscultadores/PA isolado).
- **Arpejo** (no ⚙): ligado/desligado (tecla **A**), densidade (o mesmo que o ↕ do nó vida) e volume. A densidade reage à sala: em silêncio quase não toca, quando alguém toca abre. As teclas por grau da escala contam a partir da fundamental do acorde que está a soar (1-3-5 = tríade), por isso o arpejo acompanha as mudanças de acorde; escolhe também 1–3 oitavas e o padrão (sobe, desce, sobe e desce, aleatório).

O áudio é processado no próprio browser: nada é gravado nem enviado para servidores.

## Online

O site é estático e corre em qualquer alojamento com HTTPS (o microfone exige HTTPS).

**Railway**: em railway.app → *New Project* → *Deploy from GitHub repo* → escolhe `resona`. O Railway usa o `Dockerfile` (Caddy a servir os ficheiros) e volta a publicar a cada push para `main`. Em *Settings → Networking → Generate Domain* obténs o endereço público.

A partir desse endereço, o Chrome/Edge oferece **Instalar app**: fica numa janela própria e funciona offline.

## Programa para instalar (Windows, macOS, Linux)

A versão desktop é uma app Electron que carrega os ficheiros por um protocolo interno (`resona://`): não abre servidor nem localhost.

- **Usar a partir do código**: `npm install` e depois `npm run desktop`.
- **Gerar o instalador localmente**: `npm run dist:win` (ou `dist:mac` num Mac, `dist:linux`). O instalador fica em `dist/`.
- **Gerar os três de uma vez no GitHub**: cria uma tag de versão (`git tag v1.0.0 && git push origin v1.0.0`). O workflow `desktop` constrói os instaladores e junta-os a um *release* em rascunho, que publicas na página *Releases*.

Os instaladores não estão assinados: no Windows aparece o aviso do SmartScreen (*Mais informações → Executar mesmo assim*); no macOS abre-se com clique direito → *Abrir*.

## Licença

MIT — ver [LICENSE](LICENSE).

Feito por David Marques · [monco.io](https://monco.io) · [Ko-fi](https://ko-fi.com/dferreiramarques)
