/**
 * See https://discord.com/developers/docs/resources/channel#create-message
 * for details on how to send images in embeds to Discord via webhooks.
 */
const FormData = require("form-data");
const axios = require("axios").default;

const sendImagesWebhook = async (args, files) => {
  try {
    // Strip http(s) and www from URL.
    const strippedURL = args.screenshotURL.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "");

    // Setup embeds for Discord.
    let embeds = [];
    for (let i = 0; i < files.length; i++) {
      let embed = {};
      if (files.length == 1) {
        embed.description = `Screenshot of **${strippedURL}**.`;
      } else {
        embed.description = `Screenshot ${i + 1} of ${files.length} of **${strippedURL}**.`;
      }
      embed.image = {
        url: `attachment://${i}.png`,
      };
      embed.color = 13742832; // Light purple.
      embed.footer = {
        text: `Taken: ${new Date(Date.now()).toLocaleString()}`,
      };
      embeds.push(embed);
    }
    const messageEmbed = {
      content: `<@${args.user}>`,
      embeds
    };

    // Create and send multipart/form-data to Discord webhook URL.
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append(`file${i}`, files[i], `${i}.png`);
    }
    formData.append("payload_json", JSON.stringify(messageEmbed));
    await axios.post(args.webhookURL, formData, {
      headers: formData.getHeaders(),
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

module.exports = {
  sendImagesWebhook
}