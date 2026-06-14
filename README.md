# SaraSara 📄✨

**SaraSara** é um editor de Markdown minimalista e livre de distrações, projetado com a estética limpa e profissional do *Apple Pages*. Seu nome vem da onomatopeia japonesa **"sara-sara" (さらさら)**, que evoca o som suave e contínuo de um lápis deslizando delicadamente sobre o papel.

Este aplicativo foi criado para escritores, acadêmicos e programadores que desejam a simplicidade do Markdown combinada com o poder e a elegância de um processador de texto visual moderno.

---

## 🌟 Recursos Principais

### 1. Tela de Escrita Estilo Pages
* **Design Premium:** Um canvas centralizado que simula uma folha de papel A4 com margens perfeitas, sombras suaves e tipografia moderna (Inter e Outfit).
* **Tema Dark Mac-Style:** Um modo escuro construído com fundo preto puro (`#000000`) e painéis cinza-escuro translúcidos (`#1c1c1e`) inspirados no macOS, com destaques em cor âmbar/laranja.
* **Modo Foco (Modo Distração Livre):** Oculte instantaneamente todas as barras laterais e menus com um clique para focar exclusivamente na escrita. Pressione `Esc` para sair a qualquer momento.

### 2. Barra Lateral de Formatação Dinâmica (À Direita)
* **Controle de Estilos:** Escolha cabeçalhos (H1, H2, H3), parágrafos ou citações em tempo real.
* **Alinhamento e Listas:** Ajuste o alinhamento do texto e crie listas numeradas ou com marcadores rapidamente.
* **Painéis Contextuais Inteligentes:**
  * **Tabelas:** Adicione ou remova linhas e colunas com botões dedicados.
  * **Imagens:** Insira imagens locais ou via URL, com suporte a legendas editáveis e tags ALT.
  * **Código:** Selecione a linguagem de programação desejada no seletor para organizar sua sintaxe.
* **Estatísticas do Documento:** Contagem de palavras, caracteres e estimativa do tempo de leitura sempre visíveis no rodapé da barra lateral.

### 3. Sumário Estrutural Dinâmico (À Esquerda)
* Uma barra lateral retrátil que gera automaticamente um sumário (Outline) dinâmico baseado nos títulos (H1, H2, H3) do seu documento. Clique em qualquer item para navegar suavemente até o trecho correspondente.

### 4. Sistema Multidocumentos (Abas)
* Trabalhe em vários arquivos ao mesmo tempo com uma elegante barra de abas no estilo macOS.
* Indicadores visuais de alteração (`•`) para avisar se o documento atual tem modificações pendentes.
* Salvamento automático contínuo na memória interna (`localStorage`) para evitar qualquer perda de progresso no navegador ou reinicialização.

### 5. Integração com Sistema de Arquivos Local (App Desktop)
* **Abrir arquivo (`Cmd + O` / `Ctrl + O`):** Abra qualquer arquivo `.md` do seu computador.
* **Salvar (`Cmd + S` / `Ctrl + S`):** Grava as alterações diretamente no arquivo local.
* **Salvar Como (`Cmd + Shift + S` / `Ctrl + Shift + S`):** Crie uma nova cópia do documento no diretório de sua escolha.

---

## ⌨️ Atalhos de Teclado Suportados

| Atalho | Ação |
| --- | --- |
| `Cmd + T` / `Ctrl + T` ou `Cmd + N` / `Ctrl + N` | Criar um Novo Documento (Nova Aba) |
| `Cmd + O` / `Ctrl + O` | Abrir um Arquivo Local |
| `Cmd + S` / `Ctrl + S` | Salvar Alterações no Arquivo Atual |
| `Cmd + Shift + S` / `Ctrl + Shift + S` | Salvar Como (Gravar Novo Arquivo) |
| `Cmd + W` / `Ctrl + W` | Fechar Aba Ativa (sem encerrar o app) |

---

## 🛠️ Detalhes do Projeto e Tecnologias

O **SaraSara** roda inteiramente no cliente e foi construído de forma limpa e leve:
* **Base:** HTML5 Semântico, Vanilla JavaScript (ES6+) e CSS3 customizado.
* **Motor do Editor:** Customização do Editor.js para um fluxo sem menus flutuantes invasivos.
* **Layout:** Grid customizado sob variáveis HSL no Bootstrap 5.
* **Desktop Wrapper:** Tauri v2 + Rust para compilação nativa (disponível para macOS na pasta `/macOS`).

---

## 📄 Licença

Este projeto é software livre sob os termos da licença **GNU GPL v3**. Veja o arquivo [LICENSE](LICENSE) para detalhes completos.

---

*Desenvolvido por Aya Nicodemos — Ayasoft Studios 2026.*  
*Website:* [https://ayasoft.com.br/sarasara](https://ayasoft.com.br/sarasara)
