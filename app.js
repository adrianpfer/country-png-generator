const puppeteer = require('puppeteer');
const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');

const createDirectoryIfNotExists = (dirPath) => {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    } catch (error) {
        console.error(`❌Error creando directorio en ${dirPath}:`, error);
        throw error;
    }
};

const generateAndSavePNG = async (page, htmlContent, outputPath, viewportWidth, viewportHeight, className) => {
    try {
        await page.setViewport({ width: viewportWidth, height: viewportHeight });
        if (viewportHeight > viewportWidth) {
            htmlContent = htmlContent.replace('<body class="ltr">', '<body class="ltr portrait">');
        } else {
            htmlContent = htmlContent.replace('<body class="ltr">', '<body class="ltr landscape">');
        }
        await page.setContent(htmlContent, { waitUntil: 'load' });
        await page.screenshot({ path: outputPath, fullPage: true, omitBackground: true });
        console.log(`✅ PNG generado (${className}): ${outputPath}`);
    } catch (error) {
        console.error(`❌Error generando el PNG para ${outputPath}:`, error);
    }
};

(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();

        const htmlTemplate = fs.readFileSync(path.join(__dirname, 'html/index_prewarming.html'), 'utf-8');
        const cssContent = fs.readFileSync(path.join(__dirname, 'css/styles.css'), 'utf-8');
        const htmlWithCSS = htmlTemplate.replace('<link rel="stylesheet" href="css/styles.css">', `<style>${cssContent}</style>`);
        const excelPath = 'i18n/plantilla.xlsx';
        const workbook = XLSX.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        const outputDir = path.join(__dirname, 'png');
        createDirectoryIfNotExists(outputDir);
        createDirectoryIfNotExists(path.join(outputDir, 'landscape'));
        createDirectoryIfNotExists(path.join(outputDir, 'portrait'));

        for (let row of data) {
            let htmlContent = htmlWithCSS.replace(/<!--[\s\S]*?-->/g, '');
            let hasContent = false;

            for (let i = 1; i <= 15; i++) {
                const tValue = row[`T${i}`] || '';
                const placeholder = `{T${i}}`;

                if (htmlWithCSS.includes(placeholder)) {
                    if (tValue) {
                        hasContent = true;
                        htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), tValue);
                    } else {
                        htmlContent = htmlContent.replace(new RegExp(`<[^>]+>${placeholder}</[^>]+>`, 'g'), '');
                    }
                }
            }

            if (!hasContent) {
                console.log(`⚠️ No se generó PNG para ${row.Idioma}_${row.Pais.toUpperCase()}`);
                continue;
            }

            const market = row.Pais.toLowerCase();
            const language = row.Idioma.toLowerCase();

            if (market === 'qa' && (language === 'ar' || language === 'en')) {
                const iconUrls = {
                    'ar': 'https://static.zarahome.net/assets/public/bc8c/ae1f/648d4322b548/b7f04057f8a0/ar/ar.png?ts=1738078050304',
                    'en': 'https://static.zarahome.net/assets/public/b2fa/10e6/d9154563b60c/66ed9f550b87/en/en.png?ts=1738078050587'
                };
                const iconUrl = iconUrls[language];
                const imageBlock = `<div class="container-icon-qa"><img src="${iconUrl}" class="icon-qa" alt="Zara Home"></div>`;
                htmlContent = htmlContent.replace(
                    /<div class="textgroup-footer">([\s\S]*?)<\/div>/g,
                    `<div class="textgroup-footer"><p class="footer-legal">${row.T15 || ''}</p></div>\n${imageBlock || ''}`
                );
            }

            if (['ar', 'he'].includes(language)) {
                htmlContent = htmlContent.replace('<body class="ltr">', '<body class="rtl">');
            }

            const landscapePath = path.join(outputDir, 'landscape', `${row.Idioma}_${row.Pais.toUpperCase()}.png`);
            const portraitPath = path.join(outputDir, 'portrait', `${row.Idioma}_${row.Pais.toUpperCase()}.png`);

            await generateAndSavePNG(page, htmlContent, landscapePath, 2560, 1600, 'landscape');
            await generateAndSavePNG(page, htmlContent, portraitPath, 1920, 2864, 'portrait');
        }
    } catch (error) {
        console.error('❌Error en el proceso:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();
