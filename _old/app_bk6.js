const puppeteer = require('puppeteer');
const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');

const generateSVG = async (page, selector) => {
    try {
        return await page.evaluate((selector) => {
            const applyInlineStyles = (element) => {
                const computedStyle = window.getComputedStyle(element);
                const styleProps = ['color', 'font-size', 'font-family', 'font-weight', 'font-style', 'font-display', 'src', 'margin', 'padding', 'overflow', 'text-transform', 'line-height', 'text-align', 'background-color', 'position', 'top', 'left', 'right', 'bottom', 'transform', 'width', 'height', 'display', 'justify-content', 'align-items', 'flex-direction', 'z-index', 'text-decoration'];
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
    } catch (error) {
        console.error('Error generando SVG:', error);
        throw error;
    }
};

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

const generateAndSaveSVG = async (page, htmlContent, outputPath, viewportWidth, viewportHeight, className) => {
    try {
        await page.setViewport({ width: viewportWidth, height: viewportHeight });
        if (viewportHeight > viewportWidth) {
            htmlContent = htmlContent.replace('<body class="ltr">', '<body class="ltr portrait">');
        } else {
            htmlContent = htmlContent.replace('<body class="ltr">', '<body class="ltr landscape">');
        }
        await page.setContent(htmlContent, { waitUntil: 'load' });
        const svgContent = await generateSVG(page, 'body');
        fs.writeFileSync(outputPath, svgContent, 'utf8');
        console.log(`SVG generado (${className}): ${outputPath}`);
    } catch (error) {
        console.error(`Error generando el SVG para ${outputPath}:`, error);
    }
};

(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();

        const htmlTemplate = fs.readFileSync(path.join(__dirname, 'html/index_promo.html'), 'utf-8');
        const cssContent = fs.readFileSync(path.join(__dirname, 'css/styles.css'), 'utf-8');
        const htmlWithCSS = htmlTemplate.replace('<link rel="stylesheet" href="css/styles.css">', `<style>${cssContent}</style>`);
        const excelPath = 'i18n/plantilla_test.xlsx';
        const workbook = XLSX.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        const outputDir = path.join(__dirname, 'svg');
        createDirectoryIfNotExists(outputDir);
        createDirectoryIfNotExists(path.join(outputDir, 'landscape'));
        createDirectoryIfNotExists(path.join(outputDir, 'portrait'));

        for (let row of data) {
            let htmlContent = htmlWithCSS;
            let hasContent = false;
            for (let i = 1; i <= 15; i++) {
                const tValue = row[`T${i}`] || '';
                const pRegex = new RegExp(`<p[^>]*>{T${i}}<\/p>`, 'g');
                const spanRegex = new RegExp(`<span[^>]*>{T${i}}<\/span>`, 'g'); 

                if (tValue) {
                    hasContent = true;
                    htmlContent = htmlContent.replace(new RegExp(`{T${i}}`, 'g'), tValue);
                } else {
                    htmlContent = htmlContent.replace(pRegex, '');
                    htmlContent = htmlContent.replace(spanRegex, '');
                }
            }

            if (!hasContent) continue;

            const market = row.Pais.toLowerCase();
            const language = row.Idioma.toLowerCase();

            if (market === 'qa' && (language === 'ar' || language === 'en')) {
                const iconUrls = {
                    'ar': 'https://static.zarahome.net/assets/public/bc8c/ae1f/648d4322b548/b7f04057f8a0/ar/ar.png?ts=1738078050304',
                    'en': 'https://static.zarahome.net/assets/public/b2fa/10e6/d9154563b60c/66ed9f550b87/en/en.png?ts=1738078050587'
                };
                const iconUrl = iconUrls[language];
                const imageBlock = `<div class="container-icon-qa"><img src="${iconUrl}" class="icon-qa" alt="Zara Home"></div>`;
                htmlContent = htmlContent.replace(/<p class="footer-legal">.*?<\/p>/g, `<p class="footer-legal">${row.T2}</p>\n${imageBlock}`);
            }

            if (['ar', 'he'].includes(language)) {
                htmlContent = htmlContent.replace('<body class="ltr">', '<body class="rtl">');
            }

            const landscapePath = path.join(outputDir, 'landscape', `${row.Pais.toUpperCase()}_${row.Idioma}.svg`);
            const portraitPath = path.join(outputDir, 'portrait', `${row.Pais.toUpperCase()}_${row.Idioma}.svg`);

            await generateAndSaveSVG(page, htmlContent, landscapePath, 2560, 1600, 'landscape');
            await generateAndSaveSVG(page, htmlContent, portraitPath, 1920, 2864, 'portrait');
        }
    } catch (error) {
        console.error('Error en el proceso:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();
