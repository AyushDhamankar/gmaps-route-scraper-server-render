const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.status(200).json({ status: "Hello Bhailog! Google Map Scraper is working 🚀" });
});

app.post("/get-route", async (req, res) => {
  const { source, destination, mode } = req.body;

  if (!source || !destination || !mode) {
    return res.status(400).json({
      error: "Missing required parameters: source, destination, mode",
    });
  }

  try {
    console.log(`Fetching route: ${source} -> ${destination} via ${mode}`);

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  
    const page = await browser.newPage();
  
    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "stylesheet", "font"].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
  
    console.time("Page Load");
    const mapsURL = `https://www.google.com/maps/dir/${encodeURIComponent(source)}/${encodeURIComponent(destination)}`;
    await page.goto(mapsURL, { waitUntil: "domcontentloaded" });
  
    const routeDetails = await page.evaluate((mode) => {
      let routeElements = document.querySelectorAll("div.UgZKXd.clearfix.yYG3jf");
  
      for (let route of routeElements) {
        let routeMode =
          route.querySelector(".Os0QJc.google-symbols")?.getAttribute("aria-label") || "Unknown";
  
        if (routeMode.toLowerCase() === mode.toLowerCase()) {
          return {
            mode: routeMode,
            time:
              route.querySelector("div.Fk3sm.fontHeadlineSmall")?.innerText ||
              "Not Found",
            distance:
              route.querySelector("div.ivN21e.tUEI8e.fontBodyMedium > div")?.innerText ||
              "Not Found",
          };
        }
      }
      return { message: `No ${mode} route found` };
    }, mode);
  
    await browser.close();
    console.timeEnd("Page Load");
    res.json(routeDetails);
  } catch (error) {
    console.error("Error fetching route:", error.message || error);
    res.status(500).json({ error: `Failed to fetch route details: ${error.message || "Unknown error"}` });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});