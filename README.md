# chrome-lambda-screenshot
A Lambda function that takes a full page screenshot via Puppeteer and sends it to a Discord bot.

## How it Works
This repository uses Puppeteer to grab a full-page screenshot of any website, and then sends that screenshot to a Discord channel via webhook. It is deployed to an AWS Lambda function via [chrome-aws-lambda](https://github.com/alixaxel/chrome-aws-lambda) which is hosted in a Lambda Layer (with a compressed Chromium binary) (total Lambda function deployment size is ~800kb). For a practical use case, see the [SSorBS repository](https://github.com/StevenVeshkini/SSorBS).
