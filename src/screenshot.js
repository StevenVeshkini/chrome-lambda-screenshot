const chromium = require("chrome-aws-lambda");
const {
  addExtra
} = require("puppeteer-extra");
const puppeteerExtra = addExtra(chromium.puppeteer);
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const stealthPlugin = StealthPlugin();
const puppeteerExtraPluginUserAgentOverride = require("puppeteer-extra-plugin-stealth/evasions/user-agent-override");
stealthPlugin.enabledEvasions.delete("user-agent-override");
puppeteerExtra.use(stealthPlugin);
const pluginUserAgentOverride = puppeteerExtraPluginUserAgentOverride({
  platform: "Linux x86_64",
});
puppeteerExtra.use(pluginUserAgentOverride);

const fs = require("fs");
const {
  sendImagesWebhook
} = require("./discordHook");

const WINDOW_WIDTH = 1280;
const WINDOW_HEIGHT = 800;

const createBrowser = async () => {
  let exec_path = await chromium.executablePath;
  if (process.env.AWS_EXECUTION_ENV === undefined) {
    exec_path = process.env.DEV_CHROMIUM_PATH;
  }
  const browser = await puppeteerExtra.launch({
    args: chromium.args.concat([`--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`]),
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
      waitUntil: "networkidle2"
    });
    await autoScroll(page);

    // Get the content size of the full page
    // and set the viewport to that size so it is
    // able to be screenshotted
    const client = await page.target().createCDPSession();
    const metrics = await client.send("Page.getLayoutMetrics");
    const width = Math.ceil(metrics.contentSize.width);
    const height = Math.ceil(metrics.contentSize.height);
    await page.setViewport({
      width,
      height,
    });

    let files = [];
    // Split up screenshots depending on content size
    let screenshotted = 0;
    const numScreenshots = Math.ceil(height / (WINDOW_HEIGHT * 2));

    // Can send a maximum of 10 images through Discord webhook
    let heightWindow;
    if (numScreenshots > 10) {
      heightWindow = height / 10;
    } else {
      heightWindow = height / numScreenshots;
    }
    while (screenshotted < height) {
      const ss = await page.screenshot({
        clip: {
          x: 0,
          y: screenshotted,
          width,
          height: heightWindow,
        },
      });
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

const autoScroll = async (page) => {
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
      }, 100);
    });
  });
}

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