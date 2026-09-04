import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage(); await p.setContent("<h1>ok</h1>"); console.log(await p.textContent("h1")); await b.close();
