const puppeteer = require('puppeteer');
const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Plantilla HTML con la fuente cargada
    const htmlTemplate = `
        <!DOCTYPE html>
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
                    font-display: swap; /* Asegura que la fuente se muestre incluso si tarda en cargar */
                }

                body, html {
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                    height: 100vh;
                    width: 100vw;
                    background-color: transparent !important;
                }
                .content {
                    width: 100%;
                    height: 100%;
                    position: relative;
                    background-color: transparent !important;
                }
                #T1 {
                    font-family: 'Neue Helvetica for Zara', Arial, sans-serif;
                    position: absolute;
                    top: 20%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #FEFEB8;
                    text-transform: uppercase;
                    font-size: 147px;
                    font-weight: 300;
                    line-height: 1;
                    text-align: center;
                }
                #T2 {
                    font-family: 'Neue Helvetica for Zara', Arial, sans-serif;
                    position: absolute;
                    bottom: 40%;
                    left: 50%;
                    transform: translateX(-50%);
                    text-align: center;
                    font-size: 80px;
                }
                #T3 {
                    font-family: 'Neue Helvetica for Zara', Arial, sans-serif;
                    position: absolute;
                    bottom: 10%;
                    left: 50%;
                    transform: translateX(-50%);
                    color: #CCCCCC;
                    text-align: center;
                    font-size: 18px;
                }
            </style>
        </head>
        <body>
            <div class="content">
                <div id="T1">{T1}</div>
                <div id="T2">{T2}</div>
                <div id="T3">{T3}</div>
            </div>
        </body>
        </html>
    `;

    const excelPath = 'textos.xlsx';
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Crear carpetas principales y subcarpetas
    const outputDir = path.join(__dirname, 'SVG');
    const landscapeDir = path.join(outputDir, 'LANDSCAPE');
    const portraitDir = path.join(outputDir, 'PORTRAIT');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }
    if (!fs.existsSync(landscapeDir)) {
        fs.mkdirSync(landscapeDir);
    }
    if (!fs.existsSync(portraitDir)) {
        fs.mkdirSync(portraitDir);
    }

    for (let i = 0; i < data.length; i++) {
        const row = data[i];

        // Reemplazar los valores en la plantilla
        const htmlContent = htmlTemplate
            .replace('{T1}', row.T1 || '')
            .replace('{T2}', row.T2 || '')
            .replace('{T3}', row.T3 || '');

        // Cargar el HTML en la página
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Establecer dimensiones para la versión "landscape"
        await page.setViewport({ width: 2560, height: 1500 });

        // Generar la imagen "landscape"
        const svgContentLandscape = await page.evaluate(() => {
            const content = document.querySelector('.content');

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
        });

        // Guardar el SVG "landscape" sin el sufijo _landscape
        const outputPathLandscape = path.join(landscapeDir, `${row.Pais}_${row.Idioma}.svg`);
        fs.writeFileSync(outputPathLandscape, svgContentLandscape, 'utf8'); // Asegúrate de escribir con codificación UTF-8

        console.log(`SVG generado (landscape): ${outputPathLandscape}`);

        // Ahora la versión "portrait"
        await page.setViewport({ width: 1920, height: 2864 });

        // Recargar el contenido para que se ajuste al nuevo viewport
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Generar la imagen "portrait"
        const svgContentPortrait = await page.evaluate(() => {
            const content = document.querySelector('.content');

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
        });

        // Guardar el SVG "portrait" sin el sufijo _portrait
        const outputPathPortrait = path.join(portraitDir, `${row.Pais}_${row.Idioma}.svg`);
        fs.writeFileSync(outputPathPortrait, svgContentPortrait, 'utf8'); // Asegúrate de escribir con codificación UTF-8

        console.log(`SVG generado (portrait): ${outputPathPortrait}`);
    }

    await browser.close();
})();
