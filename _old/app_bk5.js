const puppeteer = require('puppeteer');
const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');

// Función para generar SVG
const generateSVG = async (page, selector) => {
    try {
        return await page.evaluate((selector) => {
            const applyInlineStyles = (element) => {
                const computedStyle = window.getComputedStyle(element);
                const styleProps = [
                    'color', 'font-size', 'font-family', 'font-weight', 'text-transform', 'line-height',
                    'text-align', 'background-color', 'position', 'top', 'left', 'right', 'bottom',
                    'transform', 'width', 'height'
                ];
                styleProps.forEach((prop) => {
                    const value = computedStyle.getPropertyValue(prop);
                    if (value) {
                        element.style.setProperty(prop, value, 'important');
                    }
                });
                Array.from(element.children).forEach((child) => applyInlineStyles(child));
            };

            const content = document.querySelector(selector);
            applyInlineStyles(content);

            const serializer = new XMLSerializer();
            const svgWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const { width, height } = content.getBoundingClientRect();
            svgWrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            svgWrapper.setAttribute('width', width);
            svgWrapper.setAttribute('height', height);
            svgWrapper.setAttribute('viewBox', `0 0 ${width} ${height}`);

            // Agregar el contenido original como un foreignObject
            const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
            foreignObject.setAttribute('width', '100%');
            foreignObject.setAttribute('height', '100%');
            foreignObject.appendChild(content.cloneNode(true));
            svgWrapper.appendChild(foreignObject);

            return serializer.serializeToString(svgWrapper);
        }, selector);
    } catch (error) {
        console.error('Error generando SVG:', error);
        throw error; // Re-throw error to propagate it
    }
};

// Función para crear directorios si no existen
const createDirectoryIfNotExists = (dirPath) => {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    } catch (error) {
        console.error(`Error creando directorio en ${dirPath}:`, error);
        throw error;
    }
};

// Función para generar SVG y guardarlo
const generateAndSaveSVG = async (page, htmlContent, outputPath, viewportWidth, viewportHeight, className) => {
    try {
        await page.setViewport({ width: viewportWidth, height: viewportHeight });
        await page.setContent(htmlContent.replace('<div class="text-group">', `<div class="text-group ${className}">`), { waitUntil: 'load' });
        const svgContent = await generateSVG(page, '.text-group');
        fs.writeFileSync(outputPath, svgContent, 'utf8');
        console.log(`SVG generado (${className}): ${outputPath}`);
    } catch (error) {
        console.error(`Error generando el SVG para ${outputPath}:`, error);
    }
};

(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,  // Evitar la interfaz gráfica para mayor velocidad
            args: ['--no-sandbox', '--disable-setuid-sandbox'],  // Mejora de rendimiento y seguridad
        });
        const page = await browser.newPage();

        // Cargar HTML y CSS una sola vez
        const htmlTemplate = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
        const cssContent = fs.readFileSync(path.join(__dirname, 'css/styles.css'), 'utf-8');

        const htmlWithCSS = htmlTemplate.replace('<link rel="stylesheet" href="css/styles.css">', `<style>${cssContent}</style>`);

        const excelPath = 'textos.xlsx';
        const workbook = XLSX.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Crear directorios
        const outputDir = path.join(__dirname, 'svg');
        const landscapeDir = path.join(outputDir, 'landscape');
        const portraitDir = path.join(outputDir, 'portrait');
        createDirectoryIfNotExists(outputDir);
        createDirectoryIfNotExists(landscapeDir);
        createDirectoryIfNotExists(portraitDir);

        // Generación de SVG en paralelo, pero asegurando que cada generación sea manejada por separado
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const t1Text = row.T1 || '';
            const t2Text = row.T2 || '';

            // Si tanto T1 como T2 están vacíos, no generar el SVG
            if (!t1Text && !t2Text) {
                continue;
            }

            let htmlContent = htmlWithCSS
                .replace('{T1}', t1Text)
                .replace('{T2}', t2Text);

            const market = row.Pais.toLowerCase();
            const language = row.Idioma.toLowerCase();

            if (market === 'qa' && (language === 'ar' || language === 'en')) {
                const iconUrls = {
                    'ar': 'https://static.zarahome.net/assets/public/bc8c/ae1f/648d4322b548/b7f04057f8a0/ar/ar.png?ts=1738078050304',
                    'en': 'https://static.zarahome.net/assets/public/b2fa/10e6/d9154563b60c/66ed9f550b87/en/en.png?ts=1738078050587'
                };
                const iconUrl = iconUrls[language];
                const imageBlock = `<div class="container-icon-qa"><img src="${iconUrl}" class="icon-qa" alt="Zara Home"></div>`;
                htmlContent = htmlContent.replace(/<p class="footer-legal">.*?<\/p>/g, `<p class="footer-legal">${t2Text}</p>\n${imageBlock}`);
            }

            if (['ar', 'he'].includes(language)) {
                htmlContent = htmlContent.replace('<body class="ltr">', '<body class="rtl">');
            }

            // Generar SVG para landscape y portrait
            const landscapePath = path.join(landscapeDir, `${row.Pais.toUpperCase()}_${row.Idioma}.svg`);
            const portraitPath = path.join(portraitDir, `${row.Pais.toUpperCase()}_${row.Idioma}.svg`);

            await generateAndSaveSVG(page, htmlContent, landscapePath, 2560, 1600, 'landscape');
            await generateAndSaveSVG(page, htmlContent, portraitPath, 1920, 2864, 'portrait');
        }
    } catch (error) {
        console.error('Ocurrió un error en el proceso general:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();
