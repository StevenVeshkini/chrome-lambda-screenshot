const chromium = require("chrome-aws-lambda");
const { addExtra } = require("puppeteer-extra");
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

const { sendImagesWebhook } = require("./discordHook");

const createBrowser = async () => {
    let exec_path = await chromium.executablePath;
    if (process.env.AWS_EXECUTION_ENV === undefined) {
        exec_path = process.env.DEV_CHROMIUM_PATH;
    }
    const browser = await puppeteerExtra.launch({
      args: chromium.args.append(["--window-size=1280,800"]),
      defaultViewport: chromium.defaultViewport,
      executablePath: exec_path,
      headless: true,
      ignoreDefaultArgs: launchOptions.ignoreDefaultArgs,
    });
    return browser;
};

const takeScreenshot = async (args) => {
    let browser;
    try {
        browser = await createBrowser();
        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(45000);

        await page.goto(args.screenshotURL);
        await autoScroll(page);

        // Get the content size of the full page
        // and set the viewport to that size so it is
        // able to be screenshotted
        const client = await page.target().createCDPSession();
        const metrics = await client.send("Page.getLayoutMetrics");
        const width = Math.ceil(metrics.contentSize.width);
        const height = Math.ceil(metrics.contentSize.height);
        await client.send("Emulation.setDeviceMetricsOverride", {
          mobile: false,
          width,
          height,
          deviceScaleFactor: 1,
          screenOrientation: { angle: 0, type: "portraitPrimary" },
        });

        let files = [];
        const windowHeight = 800;

        // Split up screenshots depending on content size
        if (height > windowHeight * 2) {
          await page.screenshot({
            path: "/tmp/screenshot1.png",
            clip: { x: 0, y: 0, width, height: height / 2 },
          });
          files.push("/tmp/screenshot1.png");

          await page.screenshot({
            path: "/tmp/screenshot2.png",
            clip: { x: 0, y: height / 2, width, height: height / 2 },
          });
          files.push("tmp/screenshot2.png");

        } else {
            await page.screenshot({
              path: "/tmp/screenshot1.png",
              fullPage: true
            });
            files.push("/tmp/screenshot1.png");
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
            error: `An error occurred: ${err}`,
        };
    }
};