# LinkCast

Aplicativo de transmissão de vídeo via WebRTC. Os pacotes de distribuição incluem o Electron e as dependências; quem usa o aplicativo não precisa instalar Node.js, npm ou FFmpeg separadamente.

## Baixar e executar

Os pacotes para Windows, Linux e macOS são publicados como artefatos da ação **Build and Release LinkCast** na aba **Actions** do GitHub. Cada sistema precisa de seu próprio pacote:

- Windows: executável portátil `.exe`.
- Linux: imagem `.AppImage` ou pacote `.deb`.
- macOS: instalador `.dmg` ou arquivo `.zip` com o aplicativo `.app`.

No macOS, o primeiro uso pode exigir autorização do sistema para abrir um aplicativo baixado da internet. A captura da câmera, do microfone ou da tela também depende das permissões de privacidade do sistema. O AppImage pode depender de bibliotecas gráficas já fornecidas pela distribuição Linux.

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

Os pacotes de cada sistema são compilados em runners próprios, com versões fixas de Linux e macOS para manter os ambientes de build estáveis.

## Uso

- Fontes: câmera conectada ao computador ou tela/janela.
- OBS: adicione uma fonte **Browser Source**, use a URL local exibida no aplicativo e configure a fonte para **3840×2160 a 60 FPS** para a saída máxima. A qualidade real depende da câmera, da rede e do hardware de codificação.
- O controle **Volume geral** ajusta o áudio transmitido e gravado; o botão do microfone controla apenas o microfone local.
- Espectadores podem abrir a URL HTTPS `/viewer.html` exibida no aplicativo. Os links são acessíveis apenas na rede local; o destinatário precisa estar na mesma rede Wi-Fi. O LinkCast não oferece compartilhamento por redes sociais nem entrada de câmeras remotas. O firewall deve permitir o LinkCast em redes privadas e o roteador não pode bloquear a comunicação entre dispositivos.
- Atalhos globais: Ctrl/Cmd+Shift+F9 grava e F10 silencia. Personalize em `LinkCastData/shortcuts.json`, por exemplo `{"record":"Alt+F9"}`.

Gravações e dados são guardados junto ao executável quando a pasta é gravável (modo portátil); caso contrário, são guardados na pasta de dados do usuário do sistema.

O LinkCast publica o vídeo e o áudio compostos pelo servidor interno. Para usar a saída em um aplicativo de transmissão, conecte-o pela Browser Source; o LinkCast não cria um dispositivo de câmera virtual do sistema.
