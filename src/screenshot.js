const chromium = require("chrome-aws-lambda");
const { addExtra } = require("puppeteer-extra");
const puppeteerExtra = addExtra(chromium.puppeteer);
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const stealth = StealthPlugin();
puppeteerExtra.use(stealth);

const fs = require("fs");
const { sendImagesWebhook } = require("./discordHook");

const SCREEN_WIDTH = 1280;
const SCREEN_HEIGHT = 800;

const createBrowser = async () => {
  let exec_path = await chromium.executablePath;
  if (process.env.AWS_EXECUTION_ENV === undefined) {
    exec_path = process.env.DEV_CHROMIUM_PATH;
  }
  const browser = await puppeteerExtra.launch({
    args: chromium.args.concat([
      `--window-size=${SCREEN_WIDTH},${SCREEN_HEIGHT}`,
    ]),
    defaultViewport: null,
    executablePath: exec_path,
    headless: true,
    ignoreDefaultArgs: ["--enable-automation"],
  });
  return browser;
};

const takeScreenshot = async (args) => {
  let browser;
  try {
    browser = await createBrowser();
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(45000);

    await page.goto(args.screenshotURL, {
      waitUntil: "networkidle0",
    });

    // Scrolls through the page to force lazy load images to load
    // then scrolls back to top of page.
    // Note: Script might end before all images are loaded.
    await autoScroll(page);
    await page.evaluate((_) => {
      window.scrollTo(0, 0);
    });

    // Get the content size of the full page
    // and set the viewport to that size so it is
    // able to be screenshotted.
    const client = await page.target().createCDPSession();
    const metrics = await client.send("Page.getLayoutMetrics");
    const contentWidth = Math.ceil(metrics.contentSize.width);
    const contentHeight = Math.ceil(metrics.contentSize.height);

    // Split up screenshots depending on page content size.
    let files = [];
    let screenshotted = 0;
    const numScreenshots = Math.ceil(contentHeight / (SCREEN_HEIGHT * 2));

    // Can send a maximum of 10 images through Discord webhook.
    let heightWindow;
    if (numScreenshots > 10) {
      heightWindow = contentHeight / 10;
    } else {
      heightWindow = contentHeight / numScreenshots;
    }

    // Set the viewport to take screenshots of the same size.
    await page.setViewport({
      width: contentWidth,
      height: Math.ceil(heightWindow),
      deviceScaleFactor: 1,
    });

    while (screenshotted < contentHeight) {
      const ss = await page.screenshot({
        clip: {
          x: 0,
          y: screenshotted,
          width: contentWidth,
          height: heightWindow,
        },
        type: "jpeg",
        quality: 75,
      });
      await page.evaluate((amount) => {
        window.scrollBy(0, amount);
      }, heightWindow);
      screenshotted += heightWindow;
      files.push(ss);
    }
    await sendImagesWebhook(args, files);
  } catch (error) {
    throw error;
  } finally {
    if (browser !== undefined) {
      await browser.close();
    }
  }
};

const autoScroll = async (page, height) => {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 250);
    });
  });
};

module.exports.handler = async (event) => {
  try {
    await takeScreenshot(event);
    return {
      statusCode: 200,
    };
  } catch (err) {
    return {
      statusCode: 400,
      error: err,
    };
  }
};
