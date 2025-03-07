const puppeteer = require('puppeteer');
const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');

// Función para generar SVG
const generateSVG = async (page, selector) => {
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
};

// Función para crear directorios si no existen
const createDirectoryIfNotExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
};

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Cargar HTML y CSS
    const htmlTemplate = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    const cssContent = fs.readFileSync(path.join(__dirname, 'css/styles.css'), 'utf-8');

    // Reemplazar CSS en el HTML
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

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        let htmlContent = htmlWithCSS
            .replace('{T1}', row.T1 || '')
            .replace('{T2}', row.T2 || '');

        let market = row.Pais.toLowerCase();
        let language = row.Idioma.toLowerCase();
        
        console.log('Mercado:', market.toUpperCase(), 'Idioma:', language);

        if (market === 'qa' && (language === 'ar' || language === 'en')) {
            let iconUrl = '';

            if (language === 'ar') {
                iconUrl = 'https://static.zarahome.net/assets/public/bc8c/ae1f/648d4322b548/b7f04057f8a0/ar/ar.png?ts=1738078050304'; 
            } else if (language === 'en') {
                iconUrl = 'https://static.zarahome.net/assets/public/b2fa/10e6/d9154563b60c/66ed9f550b87/en/en.png?ts=1738078050587';
            }

            const imageBlock = `<div class="container-icon-qa"><img src="${iconUrl}" class="icon-qa" alt="Zara Home"></div>`;

            htmlContent = htmlContent.replace(/<p class="footer-legal">.*?<\/p>/g, `<p class="footer-legal">${row.T2 || ''}</p>\n${imageBlock}`);
        } 

        // console.log(htmlContent);

        // Comprobar si el idioma es RTL
        if (row.Idioma === 'ar' || row.Idioma === 'he') {
            htmlContent = htmlContent.replace('<body class="ltr">', '<body class="rtl">');
        }

        // Generar SVG landscape
        await page.setViewport({ width: 2560, height: 1600 });
        await page.setContent(htmlContent.replace('<div class="text-group">', '<div class="text-group landscape">'), { waitUntil: 'networkidle0' });
        const svgContentLandscape = await generateSVG(page, '.text-group');
        const outputPathLandscape = path.join(landscapeDir, `${row.Pais.toUpperCase()}_${row.Idioma}.svg`);
        fs.writeFileSync(outputPathLandscape, svgContentLandscape, 'utf8');
        console.log(`SVG generado (landscape): ${outputPathLandscape}`);

        // Generar SVG portrait
        await page.setViewport({ width: 1920, height: 2864 });
        await page.setContent(htmlContent.replace('<div class="text-group">', '<div class="text-group portrait">'), { waitUntil: 'networkidle0' });
        const svgContentPortrait = await generateSVG(page, '.text-group');
        const outputPathPortrait = path.join(portraitDir, `${row.Pais.toUpperCase()}_${row.Idioma}.svg`);
        fs.writeFileSync(outputPathPortrait, svgContentPortrait, 'utf8');
        console.log(`SVG generado (portrait): ${outputPathPortrait}`);
    }

    await browser.close();
})();
