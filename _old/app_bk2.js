const puppeteer = require('puppeteer');
const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');

// Función para generar SVG
const generateSVG = async (page, selector) => {
    return await page.evaluate((selector) => {
        // Función applyInlineStyles dentro de evaluate
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

    const htmlTemplate = `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Zara Home</title>
                <link rel="preload" href="https://static.zarahome.net/8/static4/itxwebstandard/fuentes/main/external/helvetica_neue/NeueHelveticaforZara-Lt.woff2" as="font" type="font/woff2" crossorigin>
                <style>
                    @font-face {
                        font-family: 'Neue Helvetica for Zara';
                        src: url('https://static.zarahome.net/8/static4/itxwebstandard/fuentes/main/external/helvetica_neue/NeueHelveticaforZara-Lt.woff2') format('woff2');
                        font-weight: 300;
                        font-style: normal;
                        font-display: swap;
                    }
                    body, html {
                        margin: 0;
                        padding: 0;
                        overflow: hidden;
                        height: 100vh;
                        width: 100vw;
                        background-color: transparent !important;
                    }
                    .text-group {
                        width: 100%;
                        height: 100%;
                        position: relative;
                        background-color: transparent !important;
                    }
                    .title.maintitle {
                        font-family: 'Neue Helvetica for Zara', Arial, sans-serif;
                        position: absolute;
                        top: 35%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        color: #FEFEB8;
                        text-transform: uppercase;
                        font-size: 150px;
                        font-weight: 300;
                        line-height: 1;
                        text-align: center;
                        width: 100%;
                    }
                    .footer-legal {
                        font-family: 'Neue Helvetica for Zara', Arial, sans-serif;
                        position: absolute;
                        bottom: 10%;
                        left: 50%;
                        transform: translateX(-50%);
                        color: #CCCCCC;
                        text-align: center;
                        font-size: 18px;
                        width: 100%;
                    }
                    .container-icon-qa {
                        position: absolute;
                        bottom: 20%;
                        left: 8%;
                        width: 8%;
                        height: auto;
                    }
                    .rtl .container-icon-qa {
                        left: auto;
                        right: 8%;
                    }
                    .portrait .title.maintitle {
                        font-size: 200px;
                    }
                    .portrait .footer-legal {
                        font-size: 30px;
                    }
                    .portrait .container-icon-qa {
                        width: 20%;
                    }
                </style>
            </head>
            <body>
                <div class="text-group">
                    <p class="title maintitle">{T1}</p>
                    <p class="footer-legal">{T2}</p>
                    <div class="container-icon-qa">
                        <img src="{ICON}" class="icon-qa" alt="Zara Home">
                    </div>
                </div>
            </body>
        </html>`;

    const excelPath = 'textos.xlsx';
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Crear directorios
    const outputDir = path.join(__dirname, 'SVG');
    const landscapeDir = path.join(outputDir, 'LANDSCAPE');
    const portraitDir = path.join(outputDir, 'PORTRAIT');
    createDirectoryIfNotExists(outputDir);
    createDirectoryIfNotExists(landscapeDir);
    createDirectoryIfNotExists(portraitDir);

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        let htmlContent = htmlTemplate
            .replace('{T1}', row.T1 || '')
            .replace('{T2}', row.T2 || '')
            .replace('{ICON}', row.ICON || '');

        // Comprobar si el idioma es RTL (esto depende de la lógica que tengas en tu Excel)
        if (row.Idioma === 'ar' || row.Idioma === 'he') { 
            htmlContent = htmlContent.replace('<body>', '<body class="rtl">');
        } else {
            htmlContent = htmlContent.replace('<body>', '<body class="ltr">');
        }

        // Generar SVG "landscape"
        await page.setViewport({ width: 2560, height: 1500 });
        await page.setContent(htmlContent.replace('<div class="text-group">', '<div class="text-group landscape">'), { waitUntil: 'networkidle0' });
        const svgContentLandscape = await generateSVG(page, '.text-group');
        const outputPathLandscape = path.join(landscapeDir, `${row.Pais.toUpperCase()}_${row.Idioma}.svg`);
        fs.writeFileSync(outputPathLandscape, svgContentLandscape, 'utf8');
        console.log(`SVG generado (landscape): ${outputPathLandscape}`);

        // Generar SVG "portrait"
        await page.setViewport({ width: 1920, height: 2864 });
        await page.setContent(htmlContent.replace('<div class="text-group">', '<div class="text-group portrait">'), { waitUntil: 'networkidle0' });
        const svgContentPortrait = await generateSVG(page, '.text-group');
        const outputPathPortrait = path.join(portraitDir, `${row.Pais.toUpperCase()}_${row.Idioma}.svg`);
        fs.writeFileSync(outputPathPortrait, svgContentPortrait, 'utf8');
        console.log(`SVG generado (portrait): ${outputPathPortrait}`);
    }

    await browser.close();
})();
