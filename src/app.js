// Copyright (C) 2026 Aya Nicodemos (Ayasoft Studios)
// SaraSara is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License.

/**
 * SARASARA - MARKDOWN EDITOR ESTILO APPLE PAGES
 * Core Application Logic
 */

let editor;
let documents = [];
let activeDocId = null;
let isRendering = false;

// Internationalization (i18n) variables
let currentLanguage = localStorage.getItem('sarasara_lang') || 'pt-BR';
let translations = {};

// 1. CUSTOM FRONTEND-ONLY IMAGE TOOL FOR EDITOR.JS
class SimpleImage {
  static get toolbox() {
    return {
      title: getTranslation('toolbar.media', 'Imagem'),
      icon: '<span class="material-symbols-outlined fs-5">image</span>'
    };
  }

  constructor({ data, api }) {
    this.data = data || {};
    this.api = api;
    this.wrapper = undefined;
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('custom-image-block');

    if (this.data.url) {
      this._renderImage(this.data.url);
    } else {
      this._renderPlaceholder();
    }

    return this.wrapper;
  }

  _renderPlaceholder() {
    this.wrapper.innerHTML = '';
    const placeholder = document.createElement('div');
    placeholder.classList.add('custom-image-placeholder');
    placeholder.innerHTML = `
      <div class="custom-image-placeholder-content w-100 d-flex flex-column align-items-center">
        <span class="material-symbols-outlined">image</span>
        <div class="fw-semibold">${getTranslation('editor.imageAdd', 'Adicionar Imagem')}</div>
        
        <button class="btn btn-sm btn-outline-secondary mt-2 btn-upload-local px-3" type="button">
          ${getTranslation('tooltip.uploadImage', 'Upload do Computador')}
        </button>
        
        <div class="d-flex align-items-center gap-2 mt-3 w-100 px-4" style="max-width: 400px;">
          <input type="text" class="form-control form-control-sm img-url-input text-center" 
            placeholder="http://... ou caminho da imagem">
          <button class="btn btn-sm btn-warning btn-apply-url d-flex align-items-center justify-content-center" type="button">
            <span class="material-symbols-outlined fs-6">check</span>
          </button>
        </div>
      </div>
    `;

    // Local upload button listener
    const btnUpload = placeholder.querySelector('.btn-upload-local');
    btnUpload.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (window.__TAURI__) {
        try {
          const filePath = await window.__TAURI__.dialog.open({
            multiple: false,
            filters: [{
              name: 'Imagens',
              extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']
            }]
          });
          
          if (!filePath) return;
          
          const separator = filePath.includes('\\') ? '\\' : '/';
          const fileName = filePath.split(separator).pop();
          
          let savedUrl = filePath;
          
          if (activeDocId) {
            const doc = documents.find(d => d.id === activeDocId);
            if (doc && doc.filePath) {
              const parentDir = getDirectoryPath(doc.filePath);
              const baseName = getFileBaseName(doc.filePath);
              const docSeparator = doc.filePath.includes('\\') ? '\\' : '/';
              const mediaDirName = baseName + '_media';
              const mediaDir = parentDir + docSeparator + mediaDirName;
              const destPath = mediaDir + docSeparator + fileName;
              
              try {
                await window.__TAURI__.fs.mkdir(mediaDir, { recursive: true });
                await window.__TAURI__.fs.copyFile(filePath, destPath);
                savedUrl = mediaDirName + '/' + fileName;
              } catch (copyErr) {
                console.error("Erro ao copiar imagem localmente:", copyErr);
              }
            }
          }
          
          this.data.url = savedUrl;
          this.data.caption = fileName;
          this.data.alt = fileName;
          this._renderImage(savedUrl);
          
          setTimeout(() => { updateActiveBlockStylesInSidebar(); }, 100);
        } catch (err) {
          console.error("Erro ao selecionar imagem via Tauri:", err);
        }
        return;
      }

      // Web Fallback
      const fileInput = document.getElementById('localImageFileInput');
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target.result;
            this.data.url = base64;
            this.data.caption = file.name;
            this.data.alt = file.name;
            this._renderImage(base64);
            setTimeout(() => { updateActiveBlockStylesInSidebar(); }, 100);
          };
          reader.readAsDataURL(file);
        }
      };
      fileInput.click();
    });

    // Apply URL button listener
    const btnApply = placeholder.querySelector('.btn-apply-url');
    const urlInput = placeholder.querySelector('.img-url-input');
    
    urlInput.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    urlInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        btnApply.click();
      }
    });

    btnApply.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = urlInput.value.trim();
      if (url) {
        this.data.url = url;
        const separator = url.includes('\\') ? '\\' : '/';
        const fileName = url.split(separator).pop() || 'imagem';
        this.data.caption = fileName;
        this.data.alt = fileName;
        this._renderImage(url);
        setTimeout(() => { updateActiveBlockStylesInSidebar(); }, 100);
      }
    });

    this.wrapper.appendChild(placeholder);
  }

  _renderImage(url) {
    this.wrapper.innerHTML = '';
    const img = document.createElement('img');
    img.src = resolveImageUrl(url);
    img.alt = this.data.alt || 'Imagem do documento';

    const caption = document.createElement('div');
    caption.classList.add('custom-image-caption');
    caption.contentEditable = true;
    caption.setAttribute('placeholder', getTranslation('editor.imageCaptionPlaceholder', 'Digite uma legenda...'));
    caption.innerText = this.data.caption || '';
    
    caption.addEventListener('blur', () => {
      this.data.caption = caption.innerText;
    });

    this.wrapper.appendChild(img);
    this.wrapper.appendChild(caption);
  }

  save(blockContent) {
    const captionNode = blockContent.querySelector('.custom-image-caption');
    return {
      url: this.data.url || '',
      caption: captionNode ? captionNode.innerText : (this.data.caption || ''),
      alt: this.data.alt || ''
    };
  }
}

// 2. INITIALIZE EDITOR.JS & TRANSLATION ENGINE

// Global translation functions
async function loadLanguage(lang) {
  if (translations[lang]) return;
  try {
    const response = await fetch(`languages/${lang}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load translation: ${response.statusText}`);
    }
    translations[lang] = await response.json();
  } catch (err) {
    console.error("Error loading language file:", err);
    translations[lang] = translations['pt-BR'] || {};
  }
}

function getTranslation(key, defaultValue = "") {
  const langObj = translations[currentLanguage];
  if (langObj && langObj[key] !== undefined) {
    return langObj[key];
  }
  const fallbackObj = translations['pt-BR'];
  if (fallbackObj && fallbackObj[key] !== undefined) {
    return fallbackObj[key];
  }
  return defaultValue || key;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.innerText = getTranslation(key, el.innerText);
  });
  
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.setAttribute('title', getTranslation(key, el.getAttribute('title') || ''));
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', getTranslation(key, el.getAttribute('placeholder') || ''));
  });

  // Keep active document title input updated
  if (activeDocId) {
    const doc = documents.find(d => d.id === activeDocId);
    if (doc) {
      document.getElementById('documentTitleInput').value = doc.title;
    }
  }
}

async function switchLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem('sarasara_lang', lang);
  
  await loadLanguage(lang);
  applyTranslations();

  // Update native macOS menu and About dialog metadata
  if (window.__TAURI__ && window.__TAURI__.core) {
    try {
      await window.__TAURI__.core.invoke('update_native_menu', { lang });
    } catch (err) {
      console.error("Failed to update native menu:", err);
    }
  }
  
  // Rebuild editor to apply new localized placeholder configurations
  if (editor) {
    let savedData = { blocks: [] };
    try {
      savedData = await editor.save();
    } catch (err) {
      console.warn("Could not save editor state before language switch:", err);
      if (activeDocId) {
        const doc = documents.find(d => d.id === activeDocId);
        if (doc) savedData = doc.blocksData;
      }
    }

    if (activeDocId) {
      const doc = documents.find(d => d.id === activeDocId);
      if (doc) {
        doc.blocksData = savedData;
      }
    }

    isRendering = true;
    try {
      await editor.destroy();
    } catch (e) {
      console.error("Error destroying editor on switchLanguage:", e);
    }
    
    initEditor(savedData);
  }
}

function initEditor(initialData = null) {
  const CodeTool = window.CodeTool;
  
  editor = new EditorJS({
    holder: 'editorjs',
    data: initialData ? sanitizeBlocksData(initialData) : undefined,
    i18n: {
      messages: {
        ui: {
          blockTunes: {
            toggler: {
              "Click to tune": getTranslation("editor.clickToTune", "Clique para ajustar"),
              "or drag to move": getTranslation("editor.dragToMove", "ou arraste para mover")
            }
          },
          inlineToolbar: {
            converter: {
              "Convert to": getTranslation("editor.convertTo", "Converter para")
            }
          },
          toolbar: {
            clickToTune: getTranslation("editor.clickToTune", "Clique para ajustar")
          }
        },
        toolNames: {
          "Text": getTranslation("editor.toolText", "Texto"),
          "Heading": getTranslation("editor.toolHeading", "Título"),
          "List": getTranslation("sidebar.list", "Lista"),
          "Quote": getTranslation("toolbar.quote", "Citação"),
          "Code": getTranslation("toolbar.code", "Código"),
          "Table": getTranslation("toolbar.table", "Tabela"),
          "Delimiter": getTranslation("toolbar.divider", "Divisor"),
          "Image": getTranslation("toolbar.media", "Imagem")
        },
        tools: {
          "link": {
            "Add a link": getTranslation("editor.addLink", "Adicionar um link")
          },
          "code": {
            "Enter a code": getTranslation("editor.codePlaceholder", "Insira seu código...")
          },
          "table": {
            "Add row above": getTranslation("editor.tableAddRowAbove", "Adicionar linha acima"),
            "Add row below": getTranslation("editor.tableAddRowBelow", "Adicionar linha abaixo"),
            "Delete row": getTranslation("editor.tableDeleteRow", "Excluir linha"),
            "Add column to left": getTranslation("editor.tableAddColLeft", "Adicionar coluna à esquerda"),
            "Add column to right": getTranslation("editor.tableAddColRight", "Adicionar coluna à direita"),
            "Delete column": getTranslation("editor.tableDeleteCol", "Excluir coluna")
          }
        },
        blockTunes: {
          "delete": {
            "Delete": getTranslation("editor.deleteTune", "Excluir")
          },
          "moveUp": {
            "Move up": getTranslation("editor.moveUpTune", "Mover para cima")
          },
          "moveDown": {
            "Move down": getTranslation("editor.moveDownTune", "Mover para baixo")
          }
        }
      }
    },
    tools: {
      header: {
        class: Header,
        inlineToolbar: false,
        config: {
          placeholder: getTranslation('editor.headerPlaceholder', 'Título...'),
          levels: [1, 2, 3],
          defaultLevel: 2
        }
      },
      list: {
        class: List,
        inlineToolbar: false
      },
      code: {
        class: CodeTool,
        config: {
          placeholder: getTranslation('editor.codePlaceholder', 'Insira seu código...')
        }
      },
      quote: {
        class: Quote,
        inlineToolbar: false,
        config: {
          quotePlaceholder: getTranslation('editor.quotePlaceholder', 'Citação...'),
          captionPlaceholder: getTranslation('editor.quoteAuthorPlaceholder', 'Autor...')
        }
      },
      table: {
        class: Table,
        inlineToolbar: false
      },
      inlineCode: {
        class: InlineCode
      },
      image: {
        class: SimpleImage
      },
      delimiter: {
        class: Delimiter
      }
    },
    placeholder: getTranslation('editor.placeholder', 'Comece a escrever seu documento...'),
    onReady: async () => {
      if (!initialData) {
        setupEventListeners();
        const loaded = await loadFromLocalStorage();
        if (!loaded) {
          createNewDocument(getTranslation('document.defaultName', 'documento.md'));
        }
      } else {
        updateOutline();
        updateStats();
        updateActiveBlockStylesInSidebar();
      }
      isRendering = false;
    },
    onChange: () => {
      if (isRendering) return;
      markActiveDocumentAsDirty();
      updateOutline();
      
      if (window.statsTimeout) clearTimeout(window.statsTimeout);
      window.statsTimeout = setTimeout(async () => {
        let activeDoc;
        if (activeDocId) {
          activeDoc = documents.find(d => d.id === activeDocId);
          if (activeDoc) {
            try {
              activeDoc.blocksData = await editor.save();
            } catch (e) {
              console.error("Erro ao auto-salvar blocksData:", e);
            }
          }
        }
        await updateStats();
        saveAllToLocalStorage();

        // Auto-save physical file if active and filePath exists
        if (activeDoc && activeDoc.filePath) {
          await autoSavePhysicalFile(activeDoc);
        }
      }, 800);
    }
  });
}

function initSetupWizard(detectedLang) {
  const overlay = document.getElementById('setupWizardOverlay');
  const step1 = document.getElementById('setupStep1');
  const step2 = document.getElementById('setupStep2');
  const btnNext = document.getElementById('btnSetupNext');
  const btnBack = document.getElementById('btnSetupBack');
  const btnStart = document.getElementById('btnSetupStart');
  const langItems = document.querySelectorAll('.setup-language-list li');
  const themeCards = document.querySelectorAll('.theme-card');
  
  let selectedLang = detectedLang;
  let selectedTheme = 'dark';
  
  // Highlight pre-selected language
  langItems.forEach(item => {
    if (item.getAttribute('data-lang') === selectedLang) {
      item.classList.add('selected');
      setTimeout(() => {
        item.scrollIntoView({ block: 'nearest' });
      }, 50);
    } else {
      item.classList.remove('selected');
    }
  });

  // Enable dark mode overlay by default
  overlay.classList.add('dark-mode');

  // Language list selection
  langItems.forEach(item => {
    item.addEventListener('click', async () => {
      langItems.forEach(li => li.classList.remove('selected'));
      item.classList.add('selected');
      selectedLang = item.getAttribute('data-lang');
      
      // Update preview translations on the fly
      currentLanguage = selectedLang;
      await loadLanguage(selectedLang);
      applyTranslations();
    });
  });

  // Next Step
  btnNext.addEventListener('click', () => {
    step1.classList.remove('active');
    step2.classList.add('active');
  });

  // Back Step
  btnBack.addEventListener('click', () => {
    step2.classList.remove('active');
    step1.classList.add('active');
  });

  // Theme selection
  themeCards.forEach(card => {
    card.addEventListener('click', () => {
      themeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedTheme = card.getAttribute('data-theme');
      
      if (selectedTheme === 'dark') {
        overlay.classList.add('dark-mode');
      } else {
        overlay.classList.remove('dark-mode');
      }
    });
  });

  // Finish setup
  btnStart.addEventListener('click', async () => {
    localStorage.setItem('sarasara_lang', selectedLang);
    localStorage.setItem('sarasara_theme', selectedTheme);
    localStorage.setItem('sarasara_setup_completed', 'true');
    
    // Apply selected theme
    document.documentElement.setAttribute('data-theme', selectedTheme);
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
      themeIcon.innerText = selectedTheme === 'dark' ? 'light_mode' : 'dark_mode';
    }
    
    // Dynamically apply selected language and initialize main app elements
    await switchLanguage(selectedLang);
    
    // Reconstruct native menu
    if (window.__TAURI__ && window.__TAURI__.core) {
      try {
        await window.__TAURI__.core.invoke('update_native_menu', { lang: selectedLang });
      } catch (err) {
        console.error("Failed to update native menu on setup finish:", err);
      }
    }
    
    // Fade out overlay
    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.classList.add('d-none');
    }, 300);
    
    // Initialize editor
    initEditor();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const setupCompleted = localStorage.getItem('sarasara_setup_completed') === 'true';
  
  if (setupCompleted) {
    // Standard startup: apply theme and language, then init editor
    const savedTheme = localStorage.getItem('sarasara_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
      themeIcon.innerText = savedTheme === 'dark' ? 'light_mode' : 'dark_mode';
    }
    
    await loadLanguage('pt-BR');
    if (currentLanguage !== 'pt-BR') {
      await loadLanguage(currentLanguage);
    }
    applyTranslations();
    initEditor();
    
    if (window.__TAURI__ && window.__TAURI__.core) {
      try {
        await window.__TAURI__.core.invoke('update_native_menu', { lang: currentLanguage });
      } catch (err) {
        console.error("Failed to update native menu on startup:", err);
      }
    }
  } else {
    // First-run setup wizard startup
    document.documentElement.setAttribute('data-theme', 'dark'); // neutral start is dark
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
      themeIcon.innerText = 'light_mode';
    }
    
    // Detect system/browser language to pre-highlight it in Step 1
    const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    let detectedLang = 'en';
    if (browserLang.startsWith('pt')) detectedLang = 'pt-BR';
    else if (browserLang.startsWith('ja')) detectedLang = 'ja';
    else if (browserLang.startsWith('de')) detectedLang = 'de';
    else if (browserLang.startsWith('es')) detectedLang = 'es';
    else if (browserLang.startsWith('fr')) detectedLang = 'fr';
    else if (browserLang.startsWith('it')) detectedLang = 'it';
    else if (browserLang.startsWith('ko')) detectedLang = 'ko';
    else if (browserLang.startsWith('ru')) detectedLang = 'ru';
    else if (browserLang.startsWith('zh')) detectedLang = 'zh-CN';
    
    currentLanguage = detectedLang;
    
    // Load detected language translations dynamically for the setup screens
    await loadLanguage('pt-BR');
    if (currentLanguage !== 'pt-BR') {
      await loadLanguage(currentLanguage);
    }
    applyTranslations();
    
    // Reveal and prepare the setup overlay
    const overlay = document.getElementById('setupWizardOverlay');
    if (overlay) {
      overlay.classList.remove('d-none');
    }
    initSetupWizard(detectedLang);
  }
});


// 3. LISTENERS & SYNC LOGIC
function setupEventListeners() {
  // Intercept Tab key inside Editor.js editable fields to insert indentation instead of triggering Plus block tune button
  document.getElementById('editorjs').addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.classList.contains('cdx-input') || activeEl.getAttribute('contenteditable') === 'true' || activeEl.tagName === 'TEXTAREA' || activeEl.closest('.ce-block'))) {
        e.preventDefault();
        e.stopPropagation();
        document.execCommand('insertText', false, '    ');
      }
    }
  }, true); // Use capture phase to intercept before Editor.js handles it

  // Theme Toggle
  const themeToggle = document.getElementById('btnThemeToggle');
  const themeIcon = document.getElementById('themeIcon');
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    let newTheme = 'dark';
    if (currentTheme === 'dark') {
      newTheme = 'light';
      themeIcon.innerText = 'dark_mode';
    } else {
      newTheme = 'dark';
      themeIcon.innerText = 'light_mode';
    }
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('sarasara_theme', newTheme);
  });

  // Focus / Distraction-Free Mode
  const btnFocusMode = document.getElementById('btnFocusMode');
  const btnExitFocus = document.getElementById('btnExitFocus');
  const appContainer = document.querySelector('.app-container');
  
  function toggleFocusMode() {
    appContainer.classList.toggle('focus-active');
  }
  btnFocusMode.addEventListener('click', toggleFocusMode);
  btnExitFocus.addEventListener('click', toggleFocusMode);
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && appContainer.classList.contains('focus-active')) {
      toggleFocusMode();
    }
  });

  // Outline (Left Sidebar) collapse
  const btnToggleOutline = document.getElementById('btnToggleOutline');
  const btnCloseOutline = document.getElementById('btnCloseOutline');
  const sidebarOutline = document.getElementById('sidebarOutline');
  
  function toggleOutline() {
    sidebarOutline.classList.toggle('collapsed');
    btnToggleOutline.classList.toggle('active');
  }
  btnToggleOutline.addEventListener('click', toggleOutline);
  btnCloseOutline.addEventListener('click', toggleOutline);

  // Format Sidebar (Right Sidebar) collapse
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const sidebarFormat = document.getElementById('sidebarFormat');
  
  function toggleFormatSidebar() {
    sidebarFormat.classList.toggle('collapsed');
    btnToggleSidebar.classList.toggle('active');
  }
  btnToggleSidebar.addEventListener('click', toggleFormatSidebar);

  // Document Rename Input Validation
  const titleInput = document.getElementById('documentTitleInput');
  titleInput.addEventListener('blur', () => {
    let val = titleInput.value.trim();
    if (val === '') val = 'documento.md';
    if (!val.endsWith('.md')) val += '.md';
    titleInput.value = val;
    
    // Sync tab title
    if (activeDocId) {
      const doc = documents.find(d => d.id === activeDocId);
      if (doc) {
        doc.title = val;
        renderTabs();
        saveAllToLocalStorage();
      }
    }
  });
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      titleInput.blur();
    }
  });

  // Core Operations
  document.getElementById('btnNew').addEventListener('click', () => {
    createNewDocument();
  });

  const btnOpen = document.getElementById('btnOpen');
  const fileImporter = document.getElementById('fileImporter');
  btnOpen.addEventListener('click', () => {
    if (window.__TAURI__ || window.showOpenFilePicker) {
      openLocalFile();
    } else {
      fileImporter.click();
    }
  });
  fileImporter.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const blocksData = markdownToEditorBlocks(text);
        const newDoc = {
          id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          title: file.name,
          blocksData: blocksData,
          fileHandle: null,
          filePath: null,
          isDirty: false
        };
        documents.push(newDoc);
        switchDocument(newDoc.id);
      };
      reader.readAsText(file);
    }
  });

  document.getElementById('btnSave').addEventListener('click', () => saveActiveDocument(false));
  document.getElementById('btnSaveAs').addEventListener('click', () => saveActiveDocument(true));
  document.getElementById('btnNewTab').addEventListener('click', () => createNewDocument());

  // Keyboard Shortcuts: 
  // - Ctrl/Cmd + S to save, Ctrl/Cmd + Shift + S to Save As
  // - Ctrl/Cmd + T or Ctrl/Cmd + N to open a new tab
  // - Ctrl/Cmd + W to close the active tab
  // - Ctrl/Cmd + O to open a file
  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    
    // Save (Cmd+S / Ctrl+S) & Save As (Cmd+Shift+S / Ctrl+Shift+S)
    if ((e.metaKey || e.ctrlKey) && key === 's') {
      e.preventDefault();
      if (e.shiftKey) {
        saveActiveDocument(true); // Save As
      } else {
        saveActiveDocument(false); // Save
      }
    }
    
    // New Tab (Cmd+T / Ctrl+T / Cmd+N / Ctrl+N)
    if ((e.metaKey || e.ctrlKey) && !e.altKey && (key === 't' || key === 'n')) {
      e.preventDefault();
      createNewDocument();
    }
    
    // Close Tab (Cmd+W / Ctrl+W)
    if ((e.metaKey || e.ctrlKey) && key === 'w') {
      e.preventDefault();
      if (activeDocId) {
        closeDocument(activeDocId);
      }
    }
    
    // Open File (Cmd+O / Ctrl+O)
    if ((e.metaKey || e.ctrlKey) && key === 'o') {
      e.preventDefault();
      const btnOpen = document.getElementById('btnOpen');
      if (btnOpen) {
        btnOpen.click();
      }
    }
  });

  // Undo & Redo (simulate command or browser command)
  document.getElementById('btnUndo').addEventListener('click', () => {
    document.execCommand('undo', false, null);
  });
  document.getElementById('btnRedo').addEventListener('click', () => {
    document.execCommand('redo', false, null);
  });

  // Insert Blocks from top bar
  document.getElementById('btnInsertTable').addEventListener('click', () => {
    const col1 = getTranslation('editor.tableCol1', 'Coluna 1');
    const col2 = getTranslation('editor.tableCol2', 'Coluna 2');
    editor.blocks.insert('table', { content: [[col1, col2], ['', '']] });
  });
  document.getElementById('btnInsertCode').addEventListener('click', () => {
    const comment = getTranslation('editor.codeInitialComment', '// Escreva seu código aqui\n');
    editor.blocks.insert('code', { code: comment, language: 'javascript' });
  });
  document.getElementById('btnInsertImage').addEventListener('click', () => {
    editor.blocks.insert('image', {});
  });
  document.getElementById('btnInsertQuote').addEventListener('click', () => {
    const quoteTxt = getTranslation('editor.quoteDefaultText', 'Citação...');
    const quoteAuthor = getTranslation('editor.quoteDefaultCaption', 'Autor');
    editor.blocks.insert('quote', { text: quoteTxt, caption: quoteAuthor });
  });
  document.getElementById('btnInsertDivider').addEventListener('click', () => {
    editor.blocks.insert('delimiter', {});
  });

  // Text Styling - Bind sidebar controls using preventDefault to keep editor focused
  const styles = [
    { id: 'btnFormatBold', cmd: 'bold' },
    { id: 'btnFormatItalic', cmd: 'italic' },
    { id: 'btnFormatStrike', cmd: 'strikeThrough' }
  ];

  styles.forEach(style => {
    const btn = document.getElementById(style.id);
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
      document.execCommand(style.cmd, false, null);
      updateFormattingPanelStates();
    });
  });

  // Inline code styling
  const btnInlineCode = document.getElementById('btnFormatInlineCode');
  btnInlineCode.addEventListener('mousedown', (e) => e.preventDefault());
  btnInlineCode.addEventListener('click', () => {
    const selection = window.getSelection();
    if (!selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      
      // Check if already in code tag
      const parent = selection.anchorNode.parentElement;
      if (parent && parent.className === 'inline-code') {
        // Unwrap
        const textNode = document.createTextNode(parent.textContent);
        parent.parentNode.replaceChild(textNode, parent);
      } else {
        // Wrap
        const codeNode = document.createElement('code');
        codeNode.className = 'inline-code';
        codeNode.innerText = selectedText;
        range.deleteContents();
        range.insertNode(codeNode);
      }
      updateFormattingPanelStates();
    }
  });

  // Link format button
  const btnFormatLink = document.getElementById('btnFormatLink');
  btnFormatLink.addEventListener('mousedown', (e) => e.preventDefault());
  btnFormatLink.addEventListener('click', () => {
    const selection = window.getSelection();
    if (selection.isCollapsed) {
      alert(getTranslation('alert.selectLinkText', 'Selecione um texto antes de inserir um link.'));
      return;
    }
    const url = prompt(getTranslation('alert.insertLinkUrl', 'Inserir Link URL:'), 'https://');
    if (url) {
      document.execCommand('createLink', false, url);
      updateFormattingPanelStates();
    }
  });

  // Alignment buttons
  const aligns = [
    { id: 'btnAlignLeft', cmd: 'justifyLeft' },
    { id: 'btnAlignCenter', cmd: 'justifyCenter' },
    { id: 'btnAlignRight', cmd: 'justifyRight' },
    { id: 'btnAlignJustify', cmd: 'justifyFull' }
  ];
  aligns.forEach(align => {
    const btn = document.getElementById(align.id);
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
      document.execCommand(align.cmd, false, null);
      updateFormattingPanelStates();
    });
  });

  // Sidebar Paragraph Style dropdown triggers
  document.querySelectorAll('.dropdown-item[data-style]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const style = e.target.getAttribute('data-style');
      if (style === 'paragraph') changeCurrentBlockType('paragraph');
      else if (style === 'h1') changeCurrentBlockType('header', { level: 1 });
      else if (style === 'h2') changeCurrentBlockType('header', { level: 2 });
      else if (style === 'h3') changeCurrentBlockType('header', { level: 3 });
      else if (style === 'quote') changeCurrentBlockType('quote');
    });
  });

  // Sidebar List triggers
  document.getElementById('btnListBullet').addEventListener('click', () => {
    changeCurrentBlockType('list', { style: 'unordered' });
  });
  document.getElementById('btnListOrdered').addEventListener('click', () => {
    changeCurrentBlockType('list', { style: 'ordered' });
  });
  document.getElementById('btnListNone').addEventListener('click', () => {
    changeCurrentBlockType('paragraph');
  });

  // Sync cursor selection with format buttons active state
  document.addEventListener('selectionchange', updateFormattingPanelStates);
  
  // Track Editor clicks and keydowns to update sidebars contextually
  document.getElementById('editorjs').addEventListener('click', () => {
    setTimeout(updateActiveBlockStylesInSidebar, 100);
  });
  document.getElementById('editorjs').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
      setTimeout(updateActiveBlockStylesInSidebar, 100);
    }
  });

  // Contextual Image elements change triggers
  document.getElementById('imageSrcInput').addEventListener('change', updateActiveImageBlock);
  document.getElementById('imageCaptionInput').addEventListener('change', updateActiveImageBlock);
  document.getElementById('imageAltInput').addEventListener('change', updateActiveImageBlock);

  // Local image file uploader inside right formatting sidebar
  const btnUploadImageLocal = document.getElementById('btnUploadImageLocal');
  const localImageFileInput = document.getElementById('localImageFileInput');
  btnUploadImageLocal.addEventListener('click', () => {
    localImageFileInput.click();
  });
  localImageFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        document.getElementById('imageSrcInput').value = event.target.result;
        updateActiveImageBlock();
      };
      reader.readAsDataURL(file);
    }
  });

  // Code Language select trigger
  document.getElementById('codeLangSelect').addEventListener('change', async (e) => {
    const index = editor.blocks.getCurrentBlockIndex();
    const blockApi = editor.blocks.getBlockByIndex(index);
    if (blockApi && blockApi.name === 'code') {
      const data = await blockApi.save();
      const code = data.data.code;
      safeReplaceBlock(index, 'code', { code: code, language: e.target.value });
    }
  });

  // Table buttons listeners
  document.getElementById('btnTableAddRow').addEventListener('click', addRowToTable);
  document.getElementById('btnTableAddCol').addEventListener('click', addColToTable);
  document.getElementById('btnTableDelRow').addEventListener('click', delRowFromTable);
  document.getElementById('btnTableDelCol').addEventListener('click', delColFromTable);
}

// 4. SELECTION / FOCUS PANEL STATE SYNC
function updateFormattingPanelStates() {
  const isBold = document.queryCommandState('bold');
  const isItalic = document.queryCommandState('italic');
  const isStrike = document.queryCommandState('strikeThrough');

  toggleButtonActiveState('btnFormatBold', isBold);
  toggleButtonActiveState('btnFormatItalic', isItalic);
  toggleButtonActiveState('btnFormatStrike', isStrike);

  // Alignments
  toggleButtonActiveState('btnAlignLeft', document.queryCommandState('justifyLeft'));
  toggleButtonActiveState('btnAlignCenter', document.queryCommandState('justifyCenter'));
  toggleButtonActiveState('btnAlignRight', document.queryCommandState('justifyRight'));
  toggleButtonActiveState('btnAlignJustify', document.queryCommandState('justifyFull'));

  // Check if cursor is on inline code
  const selection = window.getSelection();
  let isInlineCode = false;
  if (selection.rangeCount > 0 && selection.anchorNode) {
    const parent = selection.anchorNode.parentElement;
    if (parent && (parent.tagName === 'CODE' || parent.closest('code.inline-code'))) {
      isInlineCode = true;
    }
  }
  toggleButtonActiveState('btnFormatInlineCode', isInlineCode);
}

function toggleButtonActiveState(id, isActive) {
  const btn = document.getElementById(id);
  if (btn) {
    if (isActive) btn.classList.add('active');
    else btn.classList.remove('active');
  }
}

// 5. UPDATE BLOCK STYLES SIDEBAR CONTEXTUALLY
async function updateActiveBlockStylesInSidebar() {
  if (!editor || !editor.blocks) return;
  try {
    const index = editor.blocks.getCurrentBlockIndex();
    if (index < 0) return;

    const blockApi = editor.blocks.getBlockByIndex(index);
    if (!blockApi) return;

    const blockType = blockApi.name;

    // Update paragraph style dropdown label
    let styleLabel = getTranslation("sidebar.paragraphBody", "Corpo (Parágrafo)");
    if (blockType === 'header') {
      const data = await blockApi.save();
      const level = data.data.level || 2;
      styleLabel = getTranslation(`sidebar.paragraphH${level}`, `Título ${level}`);
    } else if (blockType === 'quote') {
      styleLabel = getTranslation("sidebar.paragraphQuote", "Citação");
    } else if (blockType === 'code') {
      styleLabel = getTranslation("sidebar.codeBlock", "Bloco de Código");
    } else if (blockType === 'list') {
      styleLabel = getTranslation("sidebar.list", "Lista");
    }
    document.getElementById('currentStyleLabel').innerText = styleLabel;

    // Update list styles active state
    if (blockType === 'list') {
      const data = await blockApi.save();
      const isOrdered = data.data.style === 'ordered';
      toggleButtonActiveState('btnListBullet', !isOrdered);
      toggleButtonActiveState('btnListOrdered', isOrdered);
      toggleButtonActiveState('btnListNone', false);
    } else {
      toggleButtonActiveState('btnListBullet', false);
      toggleButtonActiveState('btnListOrdered', false);
      toggleButtonActiveState('btnListNone', true);
    }

    // Toggle Contextual Sidebar panels
    const contextSidebar = document.getElementById('contextualEditor');
    const codeOptions = document.getElementById('contextCodeOptions');
    const imageOptions = document.getElementById('contextImageOptions');
    const tableOptions = document.getElementById('contextTableOptions');

    contextSidebar.classList.add('d-none');
    codeOptions.classList.add('d-none');
    imageOptions.classList.add('d-none');
    tableOptions.classList.add('d-none');

    if (blockType === 'code') {
      contextSidebar.classList.remove('d-none');
      codeOptions.classList.remove('d-none');
      document.getElementById('contextTitle').innerText = getTranslation("context.codeTitle", "Configuração do Código");
      
      const data = await blockApi.save();
      document.getElementById('codeLangSelect').value = data.data.language || 'javascript';
    } else if (blockType === 'image') {
      contextSidebar.classList.remove('d-none');
      imageOptions.classList.remove('d-none');
      document.getElementById('contextTitle').innerText = getTranslation("context.imageTitle", "Opções da Imagem");
      
      const data = await blockApi.save();
      document.getElementById('imageSrcInput').value = data.data.url || '';
      document.getElementById('imageCaptionInput').value = data.data.caption || '';
      document.getElementById('imageAltInput').value = data.data.alt || '';
    } else if (blockType === 'table') {
      contextSidebar.classList.remove('d-none');
      tableOptions.classList.remove('d-none');
      document.getElementById('contextTitle').innerText = getTranslation("context.tableTitle", "Controles da Tabela");
    }
  } catch (err) {
    // block API is sometimes not fully ready during rapid clicks
  }
}

// Helper to safely replace a block by deleting and inserting asynchronously
function safeReplaceBlock(index, type, data, config = {}, needToFocus = true, callback = null) {
  if (!editor || !editor.blocks) return;
  try {
    editor.blocks.delete(index);
    setTimeout(() => {
      try {
        editor.blocks.insert(type, data, config, index, needToFocus);
        if (callback) {
          setTimeout(callback, 100);
        }
      } catch (err) {
        console.error("Erro ao inserir bloco no safeReplaceBlock:", err);
      }
    }, 0);
  } catch (err) {
    console.error("Erro ao deletar bloco no safeReplaceBlock:", err);
  }
}

// 6. PROGRAMMATIC BLOCK SWAPPING
async function changeCurrentBlockType(newType, additionalData = {}) {
  const index = editor.blocks.getCurrentBlockIndex();
  if (index < 0) return;

  const blockApi = editor.blocks.getBlockByIndex(index);
  if (!blockApi) return;

  const savedData = await blockApi.save();
  const oldText = savedData.data.text || '';

  let newData = {};
  if (newType === 'header') {
    newData = {
      text: oldText,
      level: additionalData.level || 2
    };
  } else if (newType === 'paragraph') {
    newData = {
      text: oldText
    };
  } else if (newType === 'quote') {
    newData = {
      text: oldText,
      caption: '',
      alignment: 'left'
    };
  } else if (newType === 'code') {
    newData = {
      code: oldText.replace(/<[^>]+>/g, ''), // strip tags
      language: 'javascript'
    };
  } else if (newType === 'list') {
    newData = {
      style: additionalData.style || 'unordered',
      items: [oldText || 'Novo item']
    };
  }

  // Swap block using safe helper
  safeReplaceBlock(index, newType, newData, {}, true, () => {
    updateActiveBlockStylesInSidebar();
    updateOutline();
  });
}

// 7. CONTEXTUAL TABLE MODIFIERS
async function addRowToTable() {
  const index = editor.blocks.getCurrentBlockIndex();
  const blockApi = editor.blocks.getBlockByIndex(index);
  if (blockApi && blockApi.name === 'table') {
    const data = await blockApi.save();
    const content = data.data.content;
    if (content.length > 0) {
      const cols = content[0].length;
      content.push(Array(cols).fill(''));
      safeReplaceBlock(index, 'table', { content });
    }
  }
}

async function addColToTable() {
  const index = editor.blocks.getCurrentBlockIndex();
  const blockApi = editor.blocks.getBlockByIndex(index);
  if (blockApi && blockApi.name === 'table') {
    const data = await blockApi.save();
    const content = data.data.content;
    content.forEach(row => row.push(''));
    safeReplaceBlock(index, 'table', { content });
  }
}

async function delRowFromTable() {
  const index = editor.blocks.getCurrentBlockIndex();
  const blockApi = editor.blocks.getBlockByIndex(index);
  if (blockApi && blockApi.name === 'table') {
    const data = await blockApi.save();
    const content = data.data.content;
    if (content.length > 1) {
      content.pop();
      safeReplaceBlock(index, 'table', { content });
    }
  }
}

async function delColFromTable() {
  const index = editor.blocks.getCurrentBlockIndex();
  const blockApi = editor.blocks.getBlockByIndex(index);
  if (blockApi && blockApi.name === 'table') {
    const data = await blockApi.save();
    const content = data.data.content;
    if (content[0].length > 1) {
      content.forEach(row => row.pop());
      safeReplaceBlock(index, 'table', { content });
    }
  }
}

// Update Active Image block data
async function updateActiveImageBlock() {
  const index = editor.blocks.getCurrentBlockIndex();
  const blockApi = editor.blocks.getBlockByIndex(index);
  if (blockApi && blockApi.name === 'image') {
    const url = document.getElementById('imageSrcInput').value;
    const caption = document.getElementById('imageCaptionInput').value;
    const alt = document.getElementById('imageAltInput').value;
    
    // Replace with new data to redraw SimpleImage block
    safeReplaceBlock(index, 'image', { url, caption, alt });
  }
}

// 8. DOCUMENT SUMÁRIO OUTLINE DRAWER
function updateOutline() {
  const container = document.getElementById('outlineContainer');
  if (!container) return;

  const headers = document.querySelectorAll('#editorjs .ce-header');

  if (headers.length === 0) {
    container.innerHTML = `<p class="text-muted small">Crie cabeçalhos (H1, H2, H3) para visualizar a estrutura do documento aqui.</p>`;
    return;
  }

  container.innerHTML = '';
  headers.forEach((header, index) => {
    const tagName = header.tagName.toLowerCase();
    const text = header.innerText.trim();

    if (text === '') return;

    if (!header.id) {
      header.id = `header-node-${index}`;
    }

    const link = document.createElement('a');
    link.href = `#${header.id}`;
    link.classList.add('outline-item');

    if (tagName === 'h1') link.classList.add('outline-h1');
    else if (tagName === 'h2') link.classList.add('outline-h2');
    else if (tagName === 'h3') link.classList.add('outline-h3');

    link.innerText = text;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      header.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    container.appendChild(link);
  });
}

// 9. DOCUMENT CHARACTER & WORD STATISTICS
// Extract parent directory of a path
function getDirectoryPath(filePath) {
  if (!filePath) return '';
  const separator = filePath.includes('\\') ? '\\' : '/';
  const parts = filePath.split(separator);
  parts.pop();
  return parts.join(separator);
}

// Extract base name without extension
function getFileBaseName(filePath) {
  if (!filePath) return '';
  const separator = filePath.includes('\\') ? '\\' : '/';
  const nameWithExt = filePath.split(separator).pop();
  const extIndex = nameWithExt.lastIndexOf('.');
  return extIndex === -1 ? nameWithExt : nameWithExt.substring(0, extIndex);
}

// Check if a path is absolute (Unix or Windows)
function isAbsolutePath(url) {
  if (!url) return false;
  if (url.startsWith('/')) return true; // Unix absolute
  if (/^[a-zA-Z]:[/\\]/.test(url)) return true; // Windows absolute (e.g. C:\ or D:/)
  if (url.startsWith('\\\\')) return true; // Windows UNC
  return false;
}

// Convert image paths to loadable WKWebView source URLs
function resolveImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http:') || url.startsWith('https:')) {
    return url;
  }
  
  if (window.__TAURI__) {
    // If it's a relative path containing _media
    const isRelative = !isAbsolutePath(url);
    if (isRelative) {
      if (activeDocId) {
        const doc = documents.find(d => d.id === activeDocId);
        if (doc && doc.filePath) {
          const parentDir = getDirectoryPath(doc.filePath);
          const separator = doc.filePath.includes('\\') ? '\\' : '/';
          const absPath = parentDir + separator + url;
          return window.__TAURI__.core.convertFileSrc(absPath);
        }
      }
    }
    // If it is an absolute path
    return window.__TAURI__.core.convertFileSrc(url);
  }
  
  return url;
}

// Copy pending absolute image paths to relative [baseName]_media/ folder
async function copyPendingImagesToLocalMedia(doc) {
  if (!window.__TAURI__ || !doc || !doc.filePath) return false;
  
  const parentDir = getDirectoryPath(doc.filePath);
  const baseName = getFileBaseName(doc.filePath);
  const separator = doc.filePath.includes('\\') ? '\\' : '/';
  const mediaDirName = baseName + '_media';
  const mediaDir = parentDir + separator + mediaDirName;
  
  let modified = false;
  
  if (doc.blocksData && doc.blocksData.blocks) {
    for (let block of doc.blocksData.blocks) {
      if (block.type === 'image' && block.data && block.data.url) {
        const url = block.data.url;
        
        // If it's an absolute file path (doesn't start with any_media/, http, data:)
        const isRelative = !isAbsolutePath(url) && !url.startsWith('http:') && !url.startsWith('https:') && !url.startsWith('data:');
        if (!isRelative) {
          const fileSeparator = url.includes('\\') ? '\\' : '/';
          const fileName = url.split(fileSeparator).pop();
          const destPath = mediaDir + separator + fileName;
          
          try {
            await window.__TAURI__.fs.mkdir(mediaDir, { recursive: true });
            await window.__TAURI__.fs.copyFile(url, destPath);
            block.data.url = mediaDirName + '/' + fileName;
            modified = true;
          } catch (e) {
            console.error("Erro ao copiar imagem pendente ao salvar:", e);
          }
        }
      }
    }
  }
  
  return modified;
}

// Remove unused media folder if it exists and has no image blocks referencing it
async function cleanUpUnusedMediaFolder(doc) {
  if (!window.__TAURI__ || !doc || !doc.filePath) return;
  
  const parentDir = getDirectoryPath(doc.filePath);
  const baseName = getFileBaseName(doc.filePath);
  const separator = doc.filePath.includes('\\') ? '\\' : '/';
  const mediaDirName = baseName + '_media';
  const mediaDir = parentDir + separator + mediaDirName;
  
  let count = 0;
  if (doc.blocksData && doc.blocksData.blocks) {
    doc.blocksData.blocks.forEach(block => {
      if (block.type === 'image' && block.data && block.data.url) {
        const url = block.data.url;
        if (url.startsWith(mediaDirName + '/') || url.startsWith(mediaDirName + '\\')) {
          count++;
        }
      }
    });
  }
  
  if (count === 0) {
    try {
      await window.__TAURI__.fs.remove(mediaDir, { recursive: true });
      console.log(`Pasta media vazia deletada: ${mediaDir}`);
    } catch (e) {
      // Directory might not exist or failed to remove, ignore
    }
  }
}

// Auto-save physical file if active and filePath exists
async function autoSavePhysicalFile(doc) {
  if (!window.__TAURI__ || !doc || !doc.filePath) return;
  try {
    const blocksData = doc.blocksData || await editor.save();
    const markdownText = editorBlocksToMarkdown(blocksData.blocks);
    await window.__TAURI__.fs.writeTextFile(doc.filePath, markdownText);
    
    // Run cleanup in background after writing file
    await cleanUpUnusedMediaFolder(doc);
    
    if (doc.isDirty) {
      doc.isDirty = false;
      renderTabs();
    }
  } catch (err) {
    console.warn("Erro no auto-salvamento físico:", err);
  }
}

let statsWorker = null;

function initStatsWorker() {
  const workerCode = `
    self.onmessage = function(e) {
      const blocks = e.data;
      let textContent = '';
      
      function extractTextFromItems(items) {
        let text = '';
        if (Array.isArray(items)) {
          items.forEach(it => {
            if (typeof it === 'string') {
              text += it + ' ';
            } else if (typeof it === 'object') {
              if (it.content) text += it.content + ' ';
              if (it.items) text += extractTextFromItems(it.items) + ' ';
            }
          });
        }
        return text;
      }
      
      blocks.forEach(block => {
        if (block.data) {
          if (block.data.text) {
            textContent += block.data.text + ' ';
          } else if (block.data.items) {
            textContent += extractTextFromItems(block.data.items) + ' ';
          } else if (block.data.code) {
            textContent += block.data.code + ' ';
          } else if (block.data.caption) {
            textContent += block.data.caption + ' ';
          }
        }
      });
      
      // Strip HTML Tags
      const cleanText = textContent.replace(/<[^>]*>/g, '').trim();
      const charCount = cleanText.length;
      const words = cleanText === '' ? [] : cleanText.split(/\\s+/);
      const wordCount = words.length;
      const readTime = Math.max(1, Math.ceil(wordCount / 200));
      
      self.postMessage({ wordCount, charCount, readTime });
    };
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  statsWorker = new Worker(URL.createObjectURL(blob));
  
  statsWorker.onmessage = function(e) {
    const { wordCount, charCount, readTime } = e.data;
    document.getElementById('statWords').innerText = wordCount;
    document.getElementById('statChars').innerText = charCount;
    const lessThanMinText = getTranslation('sidebar.readTimeValueLessThanMinute', '< 1 min');
    const minPattern = getTranslation('sidebar.readTimeValueMinutes', '{time} min');
    document.getElementById('statReadTime').innerText = wordCount === 0 ? lessThanMinText : minPattern.replace('{time}', readTime);
  };
}

async function updateStats() {
  if (!editor || !editor.save) return;
  try {
    const data = await editor.save();
    if (!statsWorker) initStatsWorker();
    statsWorker.postMessage(data.blocks || []);
  } catch (err) {
    console.error('Erro ao atualizar estatísticas:', err);
  }
}

// 10. EXPORT EDITOR.JS TO CLEAN MARKDOWN TEXT
async function exportMarkdown() {
  try {
    const outputData = await editor.save();
    const markdownText = editorBlocksToMarkdown(outputData.blocks);

    const titleInput = document.getElementById('documentTitleInput');
    const fileName = titleInput.value.trim() || 'documento.md';

    const blob = new Blob([markdownText], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    console.error('Erro ao exportar Markdown:', e);
    alert(getTranslation('alert.errorSave', 'Houve um erro ao gerar o arquivo Markdown.'));
  }
}

function editorBlocksToMarkdown(blocks) {
  let md = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    switch (block.type) {
      case 'header':
        const level = '#'.repeat(block.data.level || 2);
        md.push(`${level} ${htmlToMarkdownInline(block.data.text)}`);
        break;

      case 'paragraph':
        md.push(htmlToMarkdownInline(block.data.text));
        break;

      case 'list':
        const style = block.data.style === 'ordered' ? '1.' : '-';
        const listMd = block.data.items.map((item, idx) => {
          const prefix = style === '1.' ? `${idx + 1}.` : '-';
          return `${prefix} ${htmlToMarkdownInline(item)}`;
        }).join('\n');
        md.push(listMd);
        break;

      case 'quote':
        const text = htmlToMarkdownInline(block.data.text).replace(/\n/g, '\n> ');
        const caption = block.data.caption ? `\n> \n> — ${htmlToMarkdownInline(block.data.caption)}` : '';
        md.push(`> ${text}${caption}`);
        break;

      case 'code':
        const lang = block.data.language || '';
        md.push(`\`\`\`${lang}\n${block.data.code}\n\`\`\``);
        break;

      case 'table':
        const rows = block.data.content;
        if (rows && rows.length > 0) {
          const headerRow = rows[0].map(cell => htmlToMarkdownInline(cell)).join(' | ');
          const dividerRow = rows[0].map(() => '---').join(' | ');
          const bodyRows = rows.slice(1).map(row => row.map(cell => htmlToMarkdownInline(cell)).join(' | ')).join('\n| ');
          
          let tableMd = `| ${headerRow} |\n| ${dividerRow} |`;
          if (bodyRows && bodyRows.length > 0) {
            tableMd += `\n| ${bodyRows} |`;
          }
          md.push(tableMd);
        }
        break;

      case 'image':
        const altText = block.data.alt || block.data.caption || 'Imagem';
        const title = block.data.caption ? ` "${block.data.caption}"` : '';
        md.push(`![${altText}](${block.data.url}${title})`);
        break;

      case 'delimiter':
        md.push('---');
        break;
        
      default:
        break;
    }
  }

  return md.join('\n\n');
}

function htmlToMarkdownInline(html) {
  if (!html) return '';
  let text = html;

  // 1. Links <a href="url">text</a> -> [text](url)
  text = text.replace(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g, '[$2]($1)');

  // 2. Bold <b>text</b> or <strong>text</strong> -> **text**
  text = text.replace(/<(b|strong)[^>]*>([^<]+)<\/\1>/g, '**$2**');

  // 3. Italic <i>text</i> or <em>text</em> -> *text*
  text = text.replace(/<(i|em)[^>]*>([^<]+)<\/\1>/g, '*$2*');

  // 4. Strikethrough <del> or <s> -> ~~text~~
  text = text.replace(/<(del|s)[^>]*>([^<]+)<\/\1>/g, '~~$2~~');

  // 5. Inline Code <code class="inline-code">text</code> -> `text`
  text = text.replace(/<code[^>]*>([^<]+)<\/code>/g, '`$2`');

  // Convert HTML entities back
  text = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

  return text;
}

// Sanitizes Editor.js block data by removing duplicate or invalid (like boolean) block IDs.
// It also ensures that the blocks array is never empty (defaults to a single empty paragraph block),
// which completely prevents the "Cannot read properties of undefined (reading 'holder')" Editor.js crash.
function sanitizeBlocksData(blocksData) {
  if (!blocksData) {
    return { blocks: [{ type: 'paragraph', data: { text: '' } }] };
  }
  
  // Clone to avoid side effects
  const cleanData = { ...blocksData };
  if (!cleanData.blocks || cleanData.blocks.length === 0) {
    cleanData.blocks = [{ type: 'paragraph', data: { text: '' } }];
    return cleanData;
  }
  
  const seenIds = new Set();
  const sanitizedBlocks = [];
  
  cleanData.blocks.forEach(block => {
    if (!block) return;
    const cleanBlock = { ...block };
    if (cleanBlock.id) {
      const idStr = String(cleanBlock.id).trim();
      if (typeof cleanBlock.id !== 'string' || idStr === 'true' || idStr === 'false' || idStr === '' || seenIds.has(idStr)) {
        delete cleanBlock.id;
      } else {
        seenIds.add(idStr);
      }
    }
    sanitizedBlocks.push(cleanBlock);
  });
  
  if (sanitizedBlocks.length === 0) {
    sanitizedBlocks.push({ type: 'paragraph', data: { text: '' } });
  }
  
  cleanData.blocks = sanitizedBlocks;
  return cleanData;
}

// 11. IMPORT MARKDOWN TEXT TO EDITOR.JS BLOCKS
async function importMarkdown(markdownText) {
  try {
    const blocksData = markdownToEditorBlocks(markdownText);
    await editor.render(sanitizeBlocksData(blocksData));
    updateOutline();
    updateStats();
    setTimeout(() => { updateActiveBlockStylesInSidebar(); }, 150);
  } catch (e) {
    console.error('Erro ao renderizar Markdown importado:', e);
    alert(getTranslation('alert.errorOpen', 'Houve um erro ao processar o arquivo Markdown.'));
  }
}

function markdownToEditorBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    let line = lines[i];

    // 1. Code Block
    if (line.trim().startsWith('```')) {
      const match = line.trim().match(/^```(\w*)/);
      const language = match ? match[1] : '';
      let codeContent = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeContent.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push({
        type: 'code',
        data: {
          code: codeContent.join('\n'),
          language: language || 'plaintext'
        }
      });
      continue;
    }

    // 2. Blockquote
    if (line.trim().startsWith('>')) {
      let quoteLines = [];
      let captionText = '';
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        let text = lines[i].trim().substring(1).trim();
        if (text.startsWith('—') || text.startsWith('-')) {
          captionText = text.substring(1).trim();
        } else {
          quoteLines.push(text);
        }
        i++;
      }
      blocks.push({
        type: 'quote',
        data: {
          text: quoteLines.join('<br>'),
          caption: captionText,
          alignment: 'left'
        }
      });
      continue;
    }

    // 3. Table
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i+1].trim().includes('---')) {
      let tableContent = [];
      tableContent.push(parseTableRow(line));
      i += 2; // Skip divider row
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableContent.push(parseTableRow(lines[i]));
        i++;
      }
      blocks.push({
        type: 'table',
        data: {
          content: tableContent
        }
      });
      continue;
    }

    // 4. Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = parseInlineMarkdownToHTML(headerMatch[2]);
      blocks.push({
        type: 'header',
        data: {
          text: text,
          level: Math.min(level, 3) // header tool supports levels 1-3
        }
      });
      i++;
      continue;
    }

    // 5. Lists (unordered/ordered)
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const style = /^\d/.test(listMatch[2]) ? 'ordered' : 'unordered';
      let listItems = [parseInlineMarkdownToHTML(listMatch[3])];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        const nextListMatch = nextLine.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (nextListMatch) {
          listItems.push(parseInlineMarkdownToHTML(nextListMatch[3]));
          i++;
        } else if (nextLine.trim() === '') {
          if (i + 1 < lines.length && lines[i+1].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)) {
            i++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      blocks.push({
        type: 'list',
        data: {
          style: style,
          items: listItems
        }
      });
      continue;
    }

    // 6. Image
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      const alt = imageMatch[1];
      let urlAndTitle = imageMatch[2].trim();
      let url = urlAndTitle;
      let caption = '';
      const titleMatch = urlAndTitle.match(/^([^\s]+)\s+"([^"]+)"$/);
      if (titleMatch) {
        url = titleMatch[1];
        caption = titleMatch[2];
      }
      blocks.push({
        type: 'image',
        data: {
          url: url,
          caption: caption || alt || '',
          alt: alt || ''
        }
      });
      i++;
      continue;
    }

    // 7. Divider (Horizontal Rule)
    if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
      blocks.push({
        type: 'delimiter',
        data: {}
      });
      i++;
      continue;
    }

    // 8. Empty Line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // 9. Standard Paragraph
    blocks.push({
      type: 'paragraph',
      data: {
        text: parseInlineMarkdownToHTML(line)
      }
    });
    i++;
  }

  return {
    time: Date.now(),
    blocks: blocks,
    version: "2.28.2"
  };
}

function parseTableRow(rowText) {
  const cells = rowText.trim().replace(/^\||\|$/g, '').split('|');
  return cells.map(cell => parseInlineMarkdownToHTML(cell.trim()));
}

function parseInlineMarkdownToHTML(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 1. Bold (**, __)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  html = html.replace(/__([^_]+)__/g, '<b>$1</b>');

  // 2. Italic (*, _)
  html = html.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  html = html.replace(/_([^_]+)_/g, '<i>$1</i>');

  // 3. Strikethrough (~~)
  html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>');

  // 4. Inline Code (`)
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // 5. Links ([text](url))
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return html;
}

// 12. TAB MANAGEMENT & FILE SYSTEM ACCESS API
function renderTabs() {
  const container = document.getElementById('tabsScrollArea');
  if (!container) return;

  container.innerHTML = '';
  documents.forEach(doc => {
    const tab = document.createElement('div');
    tab.className = `tab-item ${doc.id === activeDocId ? 'active' : ''}`;

    if (doc.isDirty) {
      const dot = document.createElement('span');
      dot.className = 'tab-dirty-dot';
      tab.appendChild(dot);
    }

    const name = document.createElement('span');
    name.className = 'tab-name';
    name.innerText = doc.title;
    tab.appendChild(name);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-tab-close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDocument(doc.id);
    });
    tab.appendChild(closeBtn);

    tab.addEventListener('click', () => {
      if (doc.id !== activeDocId) {
        switchDocument(doc.id);
      }
    });

    container.appendChild(tab);
  });
}

async function switchDocument(docId) {
  if (activeDocId === docId) return;

  // Save current active doc blocks
  if (activeDocId) {
    const activeDoc = documents.find(d => d.id === activeDocId);
    if (activeDoc) {
      try {
        activeDoc.blocksData = await editor.save();
      } catch (e) {
        console.error("Erro ao salvar dados ao trocar de aba:", e);
      }
    }
  }

  activeDocId = docId;
  const newDoc = documents.find(d => d.id === activeDocId);
  if (newDoc) {
    try {
      isRendering = true;
      await editor.render(sanitizeBlocksData(newDoc.blocksData));
      isRendering = false;

      document.getElementById('documentTitleInput').value = newDoc.title;
      saveAllToLocalStorage();

      renderTabs();
      updateOutline();
      updateStats();
      setTimeout(updateActiveBlockStylesInSidebar, 100);
    } catch (e) {
      isRendering = false;
      console.error("Erro ao carregar documento na troca de aba:", e);
    }
  }
}

function createNewDocument(title = null, blocksData = { blocks: [] }) {
  if (!title) {
    title = getTranslation('document.untitled', 'Sem título.md');
  }
  const newDoc = {
    id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    title: title,
    blocksData: blocksData,
    fileHandle: null,
    filePath: null,
    isDirty: false
  };
  documents.push(newDoc);
  switchDocument(newDoc.id);
  renderTabs();
}

async function closeDocument(docId) {
  const doc = documents.find(d => d.id === docId);
  if (!doc) return;

  if (doc.isDirty) {
    const confirmMsg = getTranslation('alert.unsavedChanges', 'O documento "{title}" tem alterações não salvas. Deseja fechar mesmo assim?').replace('{title}', doc.title);
    if (!confirm(confirmMsg)) {
      return;
    }
  }

  const index = documents.findIndex(d => d.id === docId);
  documents = documents.filter(d => d.id !== docId);

  if (documents.length === 0) {
    createNewDocument(getTranslation('document.defaultName', 'documento.md'));
  } else if (activeDocId === docId) {
    const nextActiveIndex = Math.min(index, documents.length - 1);
    activeDocId = documents[nextActiveIndex].id;
    const targetDoc = documents[nextActiveIndex];

    isRendering = true;
    await editor.render(sanitizeBlocksData(targetDoc.blocksData));
    isRendering = false;

    document.getElementById('documentTitleInput').value = targetDoc.title;
  }

  saveAllToLocalStorage();
  renderTabs();
  updateOutline();
  updateStats();
  setTimeout(updateActiveBlockStylesInSidebar, 100);
}

function saveAllToLocalStorage() {
  const dataToStore = documents.map(d => ({
    id: d.id,
    title: d.title,
    blocksData: d.blocksData,
    isDirty: d.isDirty,
    filePath: d.filePath || null
  }));
  localStorage.setItem('sarasara_docs', JSON.stringify(dataToStore));
  localStorage.setItem('sarasara_active_id', activeDocId);
}

async function loadFromLocalStorage() {
  const storedDocs = localStorage.getItem('sarasara_docs') || localStorage.getItem('sara_editor_docs');
  const storedActiveId = localStorage.getItem('sarasara_active_id') || localStorage.getItem('sara_editor_active_id');

  if (storedDocs && storedActiveId) {
    try {
      const parsedDocs = JSON.parse(storedDocs);
      if (parsedDocs.length === 0) return false;
      
      documents = parsedDocs.map(d => ({
        ...d,
        fileHandle: null,
        filePath: d.filePath || null
      }));

      activeDocId = storedActiveId;
      const activeDoc = documents.find(d => d.id === activeDocId);
      
      isRendering = true;
      if (activeDoc) {
        await editor.render(sanitizeBlocksData(activeDoc.blocksData));
        document.getElementById('documentTitleInput').value = activeDoc.title;
      } else {
        activeDocId = documents[0].id;
        await editor.render(sanitizeBlocksData(documents[0].blocksData));
        document.getElementById('documentTitleInput').value = documents[0].title;
      }
      isRendering = false;

      renderTabs();
      updateOutline();
      updateStats();
      return true;
    } catch (e) {
      isRendering = false;
      console.error("Erro ao carregar dados salvos:", e);
    }
  }
  return false;
}

async function markActiveDocumentAsDirty() {
  if (!activeDocId) return;
  const doc = documents.find(d => d.id === activeDocId);
  if (doc && !doc.isDirty) {
    doc.isDirty = true;
    renderTabs();
    saveAllToLocalStorage();
  }
}

function showNotification(message) {
  const toast = document.getElementById('appToast');
  if (toast) {
    toast.innerText = message;
    toast.classList.add('visible');
    setTimeout(() => {
      toast.classList.remove('visible');
    }, 2000);
  }
}

// 13. FILE SYSTEM ACCESS API INTEGRATION
async function openLocalFile() {
  if (window.__TAURI__) {
    try {
      const filePath = await window.__TAURI__.dialog.open({
        multiple: false,
        filters: [{
          name: 'Arquivos Markdown',
          extensions: ['md', 'markdown', 'txt']
        }]
      });

      if (!filePath) return;

      const text = await window.__TAURI__.fs.readTextFile(filePath);
      
      const pathParts = filePath.split('/');
      const fileName = pathParts[pathParts.length - 1];

      const alreadyOpen = documents.find(d => d.filePath === filePath);
      if (alreadyOpen) {
        switchDocument(alreadyOpen.id);
        return;
      }

      const blocksData = markdownToEditorBlocks(text);
      const newDoc = {
        id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        title: fileName,
        blocksData: blocksData,
        fileHandle: null,
        filePath: filePath,
        isDirty: false
      };

      documents.push(newDoc);
      switchDocument(newDoc.id);
    } catch (err) {
      console.error('Erro ao abrir arquivo físico via Tauri:', err);
      alert(getTranslation('alert.errorOpen', 'Não foi possível abrir o arquivo.'));
    }
    return;
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: 'Arquivos Markdown',
        accept: { 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.txt'] }
      }],
      multiple: false
    });

    const file = await handle.getFile();
    const text = await file.text();

    const alreadyOpen = documents.find(d => d.fileHandle && d.fileHandle.name === handle.name);
    if (alreadyOpen) {
      switchDocument(alreadyOpen.id);
      return;
    }

    const blocksData = markdownToEditorBlocks(text);
    const newDoc = {
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      title: file.name,
      blocksData: blocksData,
      fileHandle: handle,
      filePath: null,
      isDirty: false
    };

    documents.push(newDoc);
    switchDocument(newDoc.id);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Erro ao abrir arquivo físico:', err);
      alert(getTranslation('alert.errorOpen', 'Não foi possível abrir o arquivo.'));
    }
  }
}

async function saveActiveDocument(forceSaveAs = false) {
  if (!activeDocId) return;
  const doc = documents.find(d => d.id === activeDocId);
  if (!doc) return;

  try {
    const blocksData = await editor.save();
    doc.blocksData = blocksData;

    if (window.__TAURI__) {
      let path = doc.filePath;

      if (forceSaveAs || !path) {
        path = await window.__TAURI__.dialog.save({
          defaultPath: doc.title || 'documento.md',
          filters: [{
            name: 'Arquivos Markdown',
            extensions: ['md']
          }]
        });

        if (!path) return;

        const pathParts = path.split('/');
        const fileName = pathParts[pathParts.length - 1];
        
        doc.filePath = path;
        doc.title = fileName;
        document.getElementById('documentTitleInput').value = fileName;
      }

      // Copy any pending absolute image paths to relative media/ folder
      const imagesUpdated = await copyPendingImagesToLocalMedia(doc);
      if (imagesUpdated) {
        isRendering = true;
        await editor.render(sanitizeBlocksData(doc.blocksData));
        isRendering = false;
      }

      const markdownText = editorBlocksToMarkdown(doc.blocksData.blocks);
      await window.__TAURI__.fs.writeTextFile(path, markdownText);
      
      // Clean up empty media folders if no images are left
      await cleanUpUnusedMediaFolder(doc);
      
      doc.isDirty = false;
      showNotification(getTranslation('toast.saved', 'Salvo com sucesso!'));
      renderTabs();
      saveAllToLocalStorage();
      return;
    }

    let handle = doc.fileHandle;

    if (forceSaveAs || !handle) {
      if (window.showSaveFilePicker) {
        handle = await window.showSaveFilePicker({
          suggestedName: doc.title || 'documento.md',
          types: [{
            description: 'Arquivos Markdown',
            accept: { 'text/markdown': ['.md'] }
          }]
        });
        doc.fileHandle = handle;
        doc.title = handle.name;
        document.getElementById('documentTitleInput').value = handle.name;
      } else {
        // Fallback for browsers without File System Access API
        exportMarkdown();
        doc.isDirty = false;
        renderTabs();
        saveAllToLocalStorage();
        return;
      }
    }

    const writable = await handle.createWritable();
    await writable.write(markdownText);
    await writable.close();

    doc.isDirty = false;
    showNotification(getTranslation('toast.saved', 'Salvo com sucesso!'));
    renderTabs();
    saveAllToLocalStorage();
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Erro ao salvar arquivo físico:', err);
      alert(getTranslation('alert.errorSave', 'Não foi possível salvar o arquivo.'));
    }
  }
}
