const FormData = require("form-data");
const axios = require("axios").default;
const fs = require("fs");

const sendImagesWebhook = async (args, files) => {
  try {
    let embeds = [];
    for (file of files) {
      let embed = {};
      embed.image = {
        url: `attachment://${file}`
      };
      embed.color = 13742832; // Light purple.
      embed.footer = {
        text: `Taken: ${new Date(Date.now()).toLocaleString()}`,
      };
      embeds.push(embed);
    }

    // Strip http(s) and www from URL.
    const strippedURL = args.screenshotURL.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "");
    const messageEmbed = {
      content: `@${args.user}, here is a **screenshot** of ${strippedURL}.`,
      embeds
    };
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append(`file${i}`, fs.createReadStream(file[i]));
    }
    formData.append("payload_json", JSON.stringify(messageEmbed));
    await axios.post(args.webhookURL, formData, {
      headers: formData.getHeaders(),
    });
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  sendImagesWebhook
}