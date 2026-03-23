// ====== State Management ======
const state = {
    layers: [], // { id, name, canvas, ctx, visible, filters, opacity, blendMode }
    activeLayerIndex: -1,
    tool: 'move',
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
    brushSize: 10,
    isDrawing: false,
    startX: 0, startY: 0,
    shapePreviewData: null,
    width: 800,
    height: 600
};

const defaultFilters = {
    Brightness: 100, Contrast: 100, Saturation: 100, HueRotation: 0,
    Blur: 0, Grayscale: 0, Invert: 0, Sepia: 0, Opacity: 100
};

// Presets Configuration
const presetSettings = {
    "None": { ...defaultFilters },
    "Drama": { Brightness: 90, Contrast: 130, Saturation: 85, Grayscale: 0, Sepia: 20 },
    "Old School": { Brightness: 110, Sepia: 60, Grayscale: 20, Blur: 1, Contrast: 90 },
    "Vintage": { Sepia: 40, Contrast: 120, Saturation: 80, Brightness: 110 },
    "B&W Noir": { Grayscale: 100, Contrast: 140, Brightness: 90 },
    "Dreamy": { Blur: 2, Brightness: 115, Saturation: 110, Contrast: 95 },
    "Cyberpunk": { HueRotation: 190, Saturation: 150, Contrast: 120 },
    "Warmth": { Sepia: 30, HueRotation: -10, Brightness: 105, Saturation: 110 }
};

// ====== DOM Elements ======
const ui = {
    wrapper: document.querySelector('.canvas-wrapper'),
    canvas: document.getElementById('image-canvas'),
    ctx: document.getElementById('image-canvas').getContext('2d'),
    imageInput: document.getElementById('image-input'),
    layersList: document.getElementById('layers-list'),
    addLayerBtn: document.getElementById('add-layer-btn'),
    deleteLayerBtn: document.getElementById('delete-layer-btn'),
    toolBtns: document.querySelectorAll('.tool-btn'),
    primaryColor: document.getElementById('primary-color'),
    secondaryColor: document.getElementById('secondary-color'),
    swapColors: document.getElementById('swap-colors'),
    brushSize: document.getElementById('brush-size'),
    brushSizeVal: document.getElementById('brush-size-val'),
    undoBtn: document.getElementById('undo-btn'),
    redoBtn: document.getElementById('redo-btn'),
    downloadBtn: document.getElementById('download-btn'),
    filterList: document.querySelector('.filters-list'),
    presetsGrid: document.querySelector('.presets-grid'),
    placeholder: document.querySelector('.placeholder'),
    compareBtn: document.getElementById('compare-btn')
};

// ====== Initialization ======
function init() {
    setupUI();
    setupCanvas();
    createSliders();
    createPresets();
    addLayer('Background');
}

function setupUI() {
    // Tools
    ui.toolBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            ui.toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.tool = btn.dataset.tool;
            ui.canvas.style.cursor = getCursorForTool(state.tool);
        });
    });

    // Colors
    ui.primaryColor.addEventListener('input', e => state.primaryColor = e.target.value);
    ui.secondaryColor.addEventListener('input', e => state.secondaryColor = e.target.value);
    ui.swapColors.addEventListener('click', () => {
        let temp = state.primaryColor;
        state.primaryColor = state.secondaryColor;
        state.secondaryColor = temp;
        ui.primaryColor.value = state.primaryColor;
        ui.secondaryColor.value = state.secondaryColor;
    });

    // Options
    ui.brushSize.addEventListener('input', e => {
        state.brushSize = e.target.value;
        ui.brushSizeVal.textContent = state.brushSize + 'px';
    });

    // Layers
    ui.addLayerBtn.addEventListener('click', () => addLayer('Layer ' + (state.layers.length + 1)));
    ui.deleteLayerBtn.addEventListener('click', () => {
        if (state.layers.length > 1 && state.activeLayerIndex >= 0) {
            state.layers.splice(state.activeLayerIndex, 1);
            state.activeLayerIndex = Math.max(0, state.activeLayerIndex - 1);
            renderLayersList();
            renderMainCanvas();
        }
    });

    // Image Upload
    ui.imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        
        ui.placeholder.style.display = "none";
        ui.canvas.style.display = "block";
        ui.compareBtn.removeAttribute("disabled");

        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            state.width = img.width;
            state.height = img.height;
            ui.canvas.width = state.width;
            ui.canvas.height = state.height;
            
            // Clear existing layers and add image as base
            state.layers = [];
            state.history = [];
            state.historyIndex = -1;
            addLayer('Background', img);
        };
    });

    // Tabs inside sidebar (from old script)
    const tabs = document.querySelectorAll(".tab-btn");
    const panels = document.querySelectorAll(".panel");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            panels.forEach(p => p.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById(tab.dataset.target).classList.add("active");
        });
    });

    // Export
    ui.downloadBtn.addEventListener("click", () => {
        const link = document.createElement("a");
        link.download = "edited-image.png";
        link.href = ui.canvas.toDataURL();
        link.click();
    });
    // Undo / Redo
    ui.undoBtn.addEventListener('click', undo);
    ui.redoBtn.addEventListener('click', redo);
}

function getCursorForTool(tool) {
    if (tool === 'brush' || tool === 'eraser') return 'crosshair';
    if (tool === 'text') return 'text';
    if (tool === 'shape') return 'crosshair';
    return 'default';
}

// ====== History System ======
function saveHistory() {
    // Drop future history if we're not at the end
    if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
    }

    const snapshot = {
        width: state.width,
        height: state.height,
        activeLayerIndex: state.activeLayerIndex,
        layers: state.layers.map(l => ({
            id: l.id,
            name: l.name,
            visible: l.visible,
            filters: { ...l.filters },
            opacity: l.opacity,
            blendMode: l.blendMode,
            imageData: l.ctx.getImageData(0, 0, state.width, state.height)
        }))
    };

    state.history.push(snapshot);
    if (state.history.length > 20) state.history.shift(); // Max 20 steps
    else state.historyIndex++;
}

function loadHistory(index) {
    if (index < 0 || index >= state.history.length) return;
    const snap = state.history[index];
    
    state.width = snap.width;
    state.height = snap.height;
    ui.canvas.width = state.width;
    ui.canvas.height = state.height;
    state.activeLayerIndex = snap.activeLayerIndex;
    
    state.layers = snap.layers.map(lSnap => {
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = state.width;
        layerCanvas.height = state.height;
        const layerCtx = layerCanvas.getContext('2d');
        layerCtx.putImageData(lSnap.imageData, 0, 0);

        return {
            id: lSnap.id,
            name: lSnap.name,
            canvas: layerCanvas,
            ctx: layerCtx,
            visible: lSnap.visible,
            filters: { ...lSnap.filters },
            opacity: lSnap.opacity,
            blendMode: lSnap.blendMode
        };
    });

    state.historyIndex = index;
    renderLayersList();
    renderMainCanvas();
    updateSlidersUI();
}

function undo() {
    if (state.historyIndex > 0) loadHistory(state.historyIndex - 1);
}

function redo() {
    if (state.historyIndex < state.history.length - 1) loadHistory(state.historyIndex + 1);
}

// ====== Layer System ======
function addLayer(name, img = null) {
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = state.width;
    layerCanvas.height = state.height;
    const layerCtx = layerCanvas.getContext('2d');

    if (img) {
        layerCtx.drawImage(img, 0, 0, state.width, state.height);
    }

    const layer = {
        id: 'layer_' + Date.now(),
        name: name,
        canvas: layerCanvas,
        ctx: layerCtx,
        visible: true,
        filters: { ...defaultFilters },
        opacity: 100,
        blendMode: 'source-over'
    };

    state.layers.push(layer);
    state.activeLayerIndex = state.layers.length - 1;
    
    renderLayersList();
    renderMainCanvas();
    updateSlidersUI();
    saveHistory();
}

function renderLayersList() {
    ui.layersList.innerHTML = '';
    [...state.layers].reverse().forEach((layer, revIdx) => {
        const idx = state.layers.length - 1 - revIdx;
        const div = document.createElement('div');
        div.className = `layer-item ${idx === state.activeLayerIndex ? 'active' : ''}`;
        
        div.innerHTML = `
            <div class="layer-visibility"><i class="${layer.visible ? 'ri-eye-line' : 'ri-eye-off-line'}"></i></div>
            <div class="layer-thumb" style="background-image: url(${layer.canvas.toDataURL()})"></div>
            <div class="layer-name">${layer.name}</div>
        `;

        div.addEventListener('click', (e) => {
            if (e.target.closest('.layer-visibility')) {
                layer.visible = !layer.visible;
                renderLayersList();
                renderMainCanvas();
                return;
            }
            state.activeLayerIndex = idx;
            renderLayersList();
            updateSlidersUI();
        });

        ui.layersList.appendChild(div);
    });
}

// Composites all visible layers onto the main canvas
function renderMainCanvas(previewOriginal = false) {
    ui.ctx.clearRect(0, 0, state.width, state.height);
    
    if (previewOriginal && state.layers.length > 0) {
        ui.ctx.drawImage(state.layers[0].canvas, 0, 0);
        return;
    }

    state.layers.forEach(layer => {
        if (!layer.visible) return;
        
        ui.ctx.save();
        ui.ctx.globalAlpha = layer.filters.Opacity / 100;
        ui.ctx.globalCompositeOperation = layer.blendMode;
        
        const f = layer.filters;
        ui.ctx.filter = `brightness(${f.Brightness}%) contrast(${f.Contrast}%) saturate(${f.Saturation}%) hue-rotate(${f.HueRotation}deg) blur(${f.Blur}px) grayscale(${f.Grayscale}%) invert(${f.Invert}%) sepia(${f.Sepia}%)`;
        
        ui.ctx.drawImage(layer.canvas, 0, 0);
        ui.ctx.restore();
    });
}

// ====== Canvas Drawing ======
function setupCanvas() {
    ui.canvas.width = state.width;
    ui.canvas.height = state.height;

    ui.canvas.addEventListener('mousedown', startDrawing);
    ui.canvas.addEventListener('mousemove', draw);
    ui.canvas.addEventListener('mouseup', stopDrawing);
    ui.canvas.addEventListener('mouseout', stopDrawing);

    // Compare preview
    ui.compareBtn.addEventListener("mousedown", () => renderMainCanvas(true));
    ui.compareBtn.addEventListener("mouseup", () => renderMainCanvas(false));
    ui.compareBtn.addEventListener("mouseleave", () => renderMainCanvas(false));
}

function getPointerPos(e) {
    const rect = ui.canvas.getBoundingClientRect();
    const scaleX = ui.canvas.width / rect.width;
    const scaleY = ui.canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function startDrawing(e) {
    if (state.activeLayerIndex < 0 || !state.layers[state.activeLayerIndex].visible) return;
    
    state.isDrawing = true;
    const pos = getPointerPos(e);
    state.startX = pos.x;
    state.startY = pos.y;
    
    const ctx = state.layers[state.activeLayerIndex].ctx;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);

    if (state.tool === 'fill') {
        ctx.fillStyle = state.primaryColor;
        ctx.fillRect(0, 0, state.width, state.height);
        renderLayersList();
        renderMainCanvas();
        state.isDrawing = false;
    } else if (state.tool === 'shape') {
        state.shapePreviewData = ctx.getImageData(0, 0, state.width, state.height);
    } else if (state.tool === 'text') {
        const textToDraw = prompt("Enter text:");
        if (textToDraw) {
            ctx.fillStyle = state.primaryColor;
            ctx.font = `${state.brushSize * 3}px 'Inter', sans-serif`;
            ctx.fillText(textToDraw, pos.x, pos.y);
            renderLayersList();
            renderMainCanvas();
        }
        state.isDrawing = false;
    }
}

function draw(e) {
    if (!state.isDrawing || state.activeLayerIndex < 0) return;

    const pos = getPointerPos(e);
    const ctx = state.layers[state.activeLayerIndex].ctx;
    
    ctx.lineWidth = state.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (state.tool === 'brush') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = state.primaryColor;
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        renderMainCanvas();
    } else if (state.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        renderMainCanvas();
    } else if (state.tool === 'shape' && state.shapePreviewData) {
        ctx.putImageData(state.shapePreviewData, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = state.secondaryColor;
        ctx.strokeStyle = state.primaryColor;
        const w = pos.x - state.startX;
        const h = pos.y - state.startY;
        ctx.fillRect(state.startX, state.startY, w, h);
        ctx.strokeRect(state.startX, state.startY, w, h);
        renderMainCanvas();
    }
}

function stopDrawing() {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    if (state.activeLayerIndex >= 0) {
        state.layers[state.activeLayerIndex].ctx.closePath();
    }
    state.shapePreviewData = null; // Clear shape preview memory
    renderLayersList();
    saveHistory();
}


// ====== Adjustments / Filters ======
function createSliders() {
    ui.filterList.innerHTML = "";
    Object.keys(defaultFilters).forEach((key) => {
        const value = defaultFilters[key];
        
        let min = 0, max = 200, unit = '%';
        if (key === 'HueRotation') { max = 360; unit = 'deg'; }
        if (key === 'Blur') { max = 20; unit = 'px'; }
        if (key === 'Grayscale' || key === 'Invert' || key === 'Sepia' || key === 'Opacity') { max = 100; }

        const div = document.createElement("div");
        div.classList.add("filter");
        div.innerHTML = `
            <div class="filter-info">
                <label>${key.replace(/([A-Z])/g, ' $1').trim()}</label>
                <span id="val-${key}">${value}${unit}</span>
            </div>
            <input type="range" id="filter-${key}" data-key="${key}" min="${min}" max="${max}" value="${value}">
        `;

        const input = div.querySelector("input");
        input.addEventListener("input", (e) => {
            if (state.activeLayerIndex >= 0) {
                const layer = state.layers[state.activeLayerIndex];
                layer.filters[key] = e.target.value;
                document.querySelector(`#val-${key}`).textContent = e.target.value + unit;
                renderMainCanvas();
            }
        });
        
        input.addEventListener("change", (e) => {
            if (state.activeLayerIndex >= 0) saveHistory();
        });

        ui.filterList.appendChild(div);
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
        if (state.activeLayerIndex >= 0) {
            state.layers[state.activeLayerIndex].filters = { ...defaultFilters };
            updateSlidersUI();
            renderMainCanvas();
        }
    });
}

function updateSlidersUI() {
    if (state.activeLayerIndex < 0) return;
    const filters = state.layers[state.activeLayerIndex].filters;

    Object.keys(filters).forEach(key => {
        const input = document.getElementById(`filter-${key}`);
        const span = document.getElementById(`val-${key}`);
        if(input && span) {
            input.value = filters[key];
            let unit = '%';
            if (key === 'HueRotation') unit = 'deg';
            if (key === 'Blur') unit = 'px';
            span.textContent = filters[key] + unit;
        }
    });
}

// ====== Presets ======
function createPresets() {
    ui.presetsGrid.innerHTML = "";
    Object.keys(presetSettings).forEach(name => {
        const btn = document.createElement("div");
        btn.classList.add("preset-card");
        
        let icon = "ri-magic-line";
        if(name === "None") icon = "ri-prohibited-line";
        if(name.includes("B&W")) icon = "ri-contrast-drop-line";
        
        btn.innerHTML = `
            <i class="${icon}"></i>
            <span>${name}</span>
        `;
        
        btn.addEventListener("click", () => applyPreset(name));
        ui.presetsGrid.appendChild(btn);
    });
}

function applyPreset(presetName) {
    if (state.activeLayerIndex < 0) return;

    const layer = state.layers[state.activeLayerIndex];
    if (presetName === "None") {
        layer.filters = { ...defaultFilters };
    } else {
        const settings = presetSettings[presetName];
        layer.filters = { ...defaultFilters };
        Object.keys(settings).forEach(key => {
            if (layer.filters[key] !== undefined) {
                layer.filters[key] = settings[key];
            }
        });
    }

    updateSlidersUI();
    renderMainCanvas();
    saveHistory();
}

// Run
init();