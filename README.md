# Fake Wallpaper

Transforma vídeos em wallpapers animados falsos para computadores que não permitem personalizar a tela de fundo. A ideia é simples: navegador em tela cheia parece wallpaper animado.

## Novidades (v2.0)

- ✅ **Suporte a dois monitores** - Coloque vídeos diferentes em cada monitor
- ✅ **Thumbnails instantâneas** - Placeholders bonitos com gradientes (sem carregar vídeos)
- ✅ **Servidor HTTP local** - Servidor via PowerShell (sem necessidade de Python)
- ✅ **Modo Kiosk** - Wallpaper perfeito sem controles visuais
- ✅ **Performance otimizada** - Carregamento instantâneo da interface

## Como usar

### Opção 1: Modo Kiosk com Servidor (Recomendado - Wallpaper Perfeito)

Esta opção abre um servidor HTTP local via PowerShell e o navegador em modo kiosk (sem controles visuais), permitindo que as thumbnails funcionem corretamente.

**Execute:**
```bash
iniciar-kiosk-com-servidor.bat
```

Isso abrirá:
- Uma janela do PowerShell com o servidor HTTP
- O Edge em modo kiosk em `http://localhost:8000`

**Para fechar:**
- Pressione `Alt+F4` no navegador
- Feche a janela do PowerShell

### Opção 2: Modo Kiosk sem Servidor (Thumbnails podem não funcionar)

Abre diretamente o arquivo HTML sem servidor. As thumbnails podem não aparecer devido a restrições de CORS.

**Para Edge:**
```bash
iniciar-kiosk.bat
```

**Para Chrome:**
```bash
iniciar-kiosk-chrome.bat
```

### Opção 3: Modo Normal (Requer Python)

Se você tiver Python instalado:
```bash
iniciar.bat
```

Ou manualmente:
```bash
python -m http.server 8000
```
Depois acesse: `http://localhost:8000`

## Controles

- **Clique esquerdo** em um vídeo: Toca no Monitor 1
- **Clique direito** em um vídeo: Toca no Monitor 2
- **ESC ou M**: Volta ao menu
- **F11**: Alterna tela cheia

## O que tem dentro

17 vídeos prontos com paisagens, espaço e abstratos. Miniatura automática gerada a partir de um frame de cada vídeo. Suporte a WebM e MP4. Opção de adicionar vídeos do computador direto pela interface.

## Como adicionar seus vídeos

Para uso temporário, clique em "Adicionar Vídeo" na grade e escolha o arquivo. Será perguntado em qual monitor usar. Para uso permanente, coloque o vídeo na pasta do projeto e adicione o nome dele no array `videoFiles` dentro do `script.js`.

## Limitações

Precisa deixar o navegador aberto. Consome mais bateria que um wallpaper nativo. Vídeos ficam sem áudio para não fazer barulho. No modo kiosk, use Alt+F4 para fechar.

## Stack

HTML, CSS e JavaScript puro. HTML5 Video API para o player, Canvas API para gerar as miniaturas, Fetch API para detectar formatos e Python http.server para servidor local.

---

Desenvolvido por Luiz Enrique. Atualizado para suporte multi-monitor.
