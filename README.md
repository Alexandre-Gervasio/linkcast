# LinkCast

Aplicativo de transmissão de vídeo via WebRTC. Os pacotes de distribuição incluem o Electron e as dependências; quem usa o aplicativo não precisa instalar Node.js, npm ou FFmpeg separadamente.

## Baixar e executar

Os pacotes para Windows, Linux e macOS são publicados como artefatos da ação **Build desktop apps** na aba **Actions** do GitHub. Cada sistema precisa de seu próprio pacote:

- Windows: executável portátil `.exe`.
- Linux: imagem `.AppImage`.
- macOS: arquivo `.zip` com o aplicativo `.app`.

No macOS, o primeiro uso pode exigir autorização do sistema para abrir um aplicativo baixado da internet. A captura de câmera, microfone ou tela também depende das permissões de privacidade do sistema. O AppImage pode depender de bibliotecas gráficas já fornecidas pela distribuição Linux.

## Compilar a partir do código

Requer Node.js e npm apenas para desenvolvimento/compilação:

```sh
npm ci
npm start
```

Para gerar o pacote correspondente ao sistema em que a compilação está rodando:

```sh
npm run build:win
npm run build:linux
npm run build:mac
```

Os pacotes de cada sistema são compilados em runners próprios na ação de build.

## Uso

- Fontes: câmera, tela/janela ou convidados (celular abre `/push.html`).
- OBS: adicione uma fonte **Browser Source**, use a URL local exibida no aplicativo e configure a fonte para **3840×2160 a 60 FPS** para a saída máxima. A qualidade real depende da câmera, da rede e do hardware de codificação.
- O controle **Volume geral** ajusta o áudio transmitido e gravado (microfone e convidados); o botão do microfone continua controlando apenas o microfone local.
- Espectadores: abram a URL HTTPS `/viewer.html` exibida no aplicativo.
- Convidados: celulares abrem `/push.html` para enviar câmera e áudio; na primeira visita, precisam aceitar o aviso do certificado autoassinado.
- Os botões oferecem compartilhamento por WhatsApp, Telegram e cópia do link. Essas URLs são locais: o destinatário precisa estar na mesma rede Wi-Fi; compartilhar pela internet exige hospedagem e relay público, que não fazem parte deste aplicativo. O firewall deve permitir o LinkCast em redes privadas e o roteador não pode bloquear a comunicação entre dispositivos.
- Atalhos globais: Ctrl/Cmd+Shift+F9 grava e F10 silencia. Personalize em `LinkCastData/shortcuts.json`, por exemplo `{"record":"Alt+F9"}`.

Gravações e dados são guardados junto ao executável quando a pasta é gravável (modo portátil); caso contrário, são guardados na pasta de dados do usuário do sistema.

O LinkCast publica o vídeo e o áudio compostos pelo servidor interno. Para usar a saída em um aplicativo de transmissão, conecte-o pela Browser Source; o LinkCast não cria um dispositivo de câmera virtual do sistema.
