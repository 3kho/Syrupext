import { writeFile } from "fs";
import puppeteer, { Browser } from "puppeteer";
const ua =
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.3";

async function getCouponCode(browser: Browser, couponLink: string) {
    const couponPage = await browser.newPage();
    await couponPage.setUserAgent(ua);

    await couponPage.goto(couponLink, {
        waitUntil: "domcontentloaded",
    });

    const couponCode = await couponPage.$("#code");
    const code = await couponCode?.evaluate((node) => {
        return node.getAttribute("value");
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    await couponPage.close();
    return code;
}

async function getCouponCodesFromDomain(domain: string) {
    const browser = await puppeteer.launch({ headless: true });
    const page = (await browser.pages())[0];
    await page.setUserAgent(ua);

    await page.goto(`https://couponfollow.com/site/${domain}`, {
        waitUntil: "networkidle0",
    });

    const articles = await page.$$("article");

    let couponLinks = await Promise.all(
        articles.map(async (article) => {
            const dataModal = await article.evaluate((node) => {
                return node.getAttribute("data-modal");
            });
            return dataModal;
        })
    );

    couponLinks = couponLinks.filter(
        (dataModal: any) =>
            dataModal !== null &&
            dataModal.includes("#") &&
            dataModal.startsWith("https://couponfollow.com/site/")
    );

    const couponCodesPromises: Promise<string | null | undefined>[] = [];
    for (const couponLink of couponLinks) {
        if (!couponLink) continue;
        couponCodesPromises.push(getCouponCode(browser, couponLink));
    }

    let couponCodes = await Promise.all(couponCodesPromises);

    couponCodes = couponCodes.filter(
        (code) => code !== null && code !== undefined
    );

    console.log(couponCodes);

    await browser.close();
    return couponCodes;
}

async function getAllStoreInAlphabet(browser: Browser, char: string) {
    const page = await browser.newPage();

    await page.goto(`https://couponfollow.com/site/browse/${char}/all`, {
        waitUntil: "networkidle0",
    });

    const storeLinks = await page.$$eval(".store-link", (nodes) => {
        return nodes.map((node) => {
            return node.getAttribute("href");
        });
    });

    const storeNames = await page.$$eval(".store-link", (nodes) => {
        return nodes.map((node) => {
            return node.textContent;
        });
    });

    let storeNamesAndLinks = storeLinks.map((storeLink, index) => {
        return {
            storeName: storeNames[index],
            storeDomain: storeLink?.replace("site/", "").replace("/", ""),
        };
    });

    await page.close();
    return storeNamesAndLinks;
}

async function getAllAlphabet() {
    const browser = await puppeteer.launch({ headless: false });

    const alhpabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0".split("");

    const alphabetPromises: Promise<
        { storeName: string | null; storeDomain: string | undefined }[]
    >[] = [];

    for (const char of alhpabet) {
        alphabetPromises.push(getAllStoreInAlphabet(browser, char));
    }

    const stores = await Promise.all(alphabetPromises);

    let allStores: {
        storeName: string | null;
        storeDomain: string | undefined;
    }[] = [];
    stores.forEach((store) => {
        allStores = allStores.concat(store);
    });

    console.log("Total Stores Count:", allStores.length);

    writeFile("stores.json", JSON.stringify(allStores), (err) => {
        if (err) {
            console.log(err);
        }
    });

    await browser.close();
    return allStores;
}

async function getAllCouponCodes() {
    const allStores = require("./stores.json");

    for (const store of allStores) {
        const coupons = await getCouponCodesFromDomain(store.storeDomain);
        store.coupons = coupons;

        console.log(`Got Coupons for ${store.storeName}: ${coupons}`);

        writeFile("coupons.json", JSON.stringify(allStores), (err) => {
            if (err) {
                console.log(err);
            }
        });
    }
}

async function getCouponForStore(storeDomain: string) {
    const allStores = require("./stores.json");

    const store = allStores.find(
        (store: any) => store.storeDomain === storeDomain
    );

    if (!store) {
        console.log("Store not found");
        return;
    }

    const coupons = await getCouponCodesFromDomain(store.storeDomain);
    store.coupons = coupons;

    writeFile("coupons.json", JSON.stringify(allStores), (err) => {
        if (err) {
            console.log(err);
        }
    });
}

getCouponForStore("codecademy.com");
