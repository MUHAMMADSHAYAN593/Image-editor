// 1. State Management
let filters = {
    Brightness: { value: 100, min: 0, max: 200, unit: "%" },
    Contrast: { value: 100, min: 0, max: 200, unit: "%" },
    Saturation: { value: 100, min: 0, max: 200, unit: "%" },
    HueRotation: { value: 0, min: 0, max: 360, unit: "deg" },
    Blur: { value: 0, min: 0, max: 20, unit: "px" },
    Grayscale: { value: 0, min: 0, max: 100, unit: "%" },
    Invert: { value: 0, min: 0, max: 100, unit: "%" },
    Sepia: { value: 0, min: 0, max: 100, unit: "%" },
    Opacity: { value: 100, min: 0, max: 100, unit: "%" },
};

// Default values for reset
const defaultFilters = JSON.parse(JSON.stringify(filters));

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

// DOM Elements
const imageCanvas = document.querySelector("#image-canvas");
const imageInput = document.querySelector("#image-input");
const CanvaCtx = imageCanvas.getContext("2d");
const filterList = document.querySelector(".filters-list");
const presetsGrid = document.querySelector(".presets-grid");
const resetBtn = document.querySelector("#reset-btn");
const downloadBtn = document.querySelector("#download-btn");
const compareBtn = document.querySelector("#compare-btn");
const placeholder = document.querySelector(".placeholder");

let file = null;
let image = null;

// 2. Initialization
function init() {
    createSliders();
    createPresets();
    setupTabs();
}

// 3. Create Sliders
function createSliders() {
    filterList.innerHTML = "";
    Object.keys(filters).forEach((key) => {
        const { value, min, max, unit } = filters[key];
        
        const div = document.createElement("div");
        div.classList.add("filter");
        
        div.innerHTML = `
            <div class="filter-info">
                <label>${key.replace(/([A-Z])/g, ' $1').trim()}</label>
                <span id="val-${key}">${value}${unit}</span>
            </div>
            <input type="range" id="${key}" min="${min}" max="${max}" value="${value}">
        `;

        const input = div.querySelector("input");
        input.addEventListener("input", (e) => {
            filters[key].value = e.target.value;
            document.querySelector(`#val-${key}`).textContent = e.target.value + unit;
            applyFilters();
        });

        filterList.appendChild(div);
    });
}

// 4. Create Presets
function createPresets() {
    presetsGrid.innerHTML = "";
    Object.keys(presetSettings).forEach(name => {
        const btn = document.createElement("div");
        btn.classList.add("preset-card");
        
        // Pick an icon based on name (just for visuals)
        let icon = "ri-magic-line";
        if(name === "None") icon = "ri-prohibited-line";
        if(name.includes("B&W")) icon = "ri-contrast-drop-line";
        
        btn.innerHTML = `
            <i class="${icon}"></i>
            <span>${name}</span>
        `;
        
        btn.addEventListener("click", () => applyPreset(name));
        presetsGrid.appendChild(btn);
    });
}

// 5. Apply Preset Logic
function applyPreset(presetName) {

    if (presetName === "None") {
        Object.keys(defaultFilters).forEach(key => {
            filters[key].value = defaultFilters[key].value;
        });
        updateSlidersUI();
        applyFilters();
        return;
    }

    const settings = presetSettings[presetName];

    Object.keys(defaultFilters).forEach(key => {
        filters[key].value = defaultFilters[key].value;
    });

    Object.keys(settings).forEach(key => {
        if (filters[key]) {
            filters[key].value = settings[key];
        }
    });

    updateSlidersUI();
    applyFilters();
}


// Helper to update slider positions after preset change
function updateSlidersUI() {
    Object.keys(filters).forEach(key => {
        const input = document.getElementById(key);
        const span = document.getElementById(`val-${key}`);
        if(input && span) {
            input.value = filters[key].value;
            span.textContent = filters[key].value + filters[key].unit;
        }
    });
}

// 6. Canvas Logic
imageInput.addEventListener("change", (event) => {
    file = event.target.files[0];
    if(!file) return;

    placeholder.style.display = "none";
    imageCanvas.style.display = "block";
    compareBtn.removeAttribute("disabled");

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
        image = img;
        // Resize canvas to fit but maintain aspect ratio logic if needed
        imageCanvas.width = img.width;
        imageCanvas.height = img.height;
        applyFilters();
    };
});

function applyFilters() {
    if (!image) return;
    
    CanvaCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);

    const f = filters;
    const filterString = `
        brightness(${f.Brightness.value}%)
        contrast(${f.Contrast.value}%)
        saturate(${f.Saturation.value}%)
        hue-rotate(${f.HueRotation.value}deg)
        blur(${f.Blur.value}px)
        grayscale(${f.Grayscale.value}%)
        invert(${f.Invert.value}%)
        sepia(${f.Sepia.value}%)
        opacity(${f.Opacity.value}%)
    `;

    CanvaCtx.filter = filterString;
    CanvaCtx.drawImage(image, 0, 0);
}

// 7. Preview / Compare Feature
compareBtn.addEventListener("mousedown", () => {
    if(!image) return;
    CanvaCtx.save();
    CanvaCtx.filter = "none";
    CanvaCtx.drawImage(image, 0, 0);
    CanvaCtx.restore();
});

compareBtn.addEventListener("mouseup", applyFilters);
compareBtn.addEventListener("mouseleave", applyFilters); // Safety check

// 8. Tab Switching
function setupTabs() {
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
}

// 9. Reset & Download
resetBtn.addEventListener("click", () => {
    filters.Brightness.value = 100; // Only update the number
    applyFilters();
    updateSlidersUI();
});

downloadBtn.addEventListener("click", () => {
    if(!image) return;
    const link = document.createElement("a");
    link.download = "edited-image.png";
    link.href = imageCanvas.toDataURL();
    link.click();
});

// Run Init
init();