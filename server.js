const { serveHTTP } = require("stremio-addon-sdk");
const addonInterface = require("./addon");

serveHTTP(addonInterface, { port: 7000 })
  .then(({ url }) => {
    console.log("Addon active on:", url);
    console.log("To install in Stremio, use:", url + "/manifest.json");
  })
  .catch((error) => {
    console.error("Failed to start addon:", error);
  });

// const { serveHTTP } = require("stremio-addon-sdk");
// const addonInterface = require("../addon");

// exports.handler = (event, context) => {
//   return new Promise((resolve) => {
//     serveHTTP(addonInterface, { port: process.env.PORT || 3000 }, () => {
//       resolve({
//         statusCode: 200,
//         body: "Add-on is running!",
//       });
//     });
//   });
// };
