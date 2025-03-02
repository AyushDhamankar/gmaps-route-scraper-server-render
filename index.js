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
    return res.status(400).json({ error: "Missing required parameters: source, destination, mode" });
  }

  let browser;
  try {
    console.log(`Fetching route: ${source} -> ${destination} via ${mode}`);

    // Launch Puppeteer for each request (avoids shared session issues)
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--single-process",
        "--no-zygote",
      ],
    });

    const page = await browser.newPage();

    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const blockedTypes = ["image", "stylesheet", "font", "media", "xhr", "fetch", "script"];
      if (blockedTypes.includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.time("Page Load");
    const mapsURL = `https://www.google.com/maps/dir/${encodeURIComponent(source)}/${encodeURIComponent(destination)}`;
    await page.goto(mapsURL, { waitUntil: "networkidle2", timeout: 20000 });

    // Extract route details
    const routeDetails = await page.evaluate((mode) => {
      let routes = document.querySelectorAll("div.UgZKXd.clearfix.yYG3jf");
      if (routes.length === 0) return { error: "No routes found." };

      for (let route of routes) {
        let routeMode = route.querySelector(".Os0QJc.google-symbols")?.getAttribute("aria-label") || "Unknown";
        if (routeMode.toLowerCase() === mode.toLowerCase()) {
          return {
            mode: routeMode,
            time: route.querySelector("div.Fk3sm.fontHeadlineSmall")?.innerText || "Not Found",
            distance: route.querySelector("div.ivN21e.tUEI8e.fontBodyMedium > div")?.innerText || "Not Found",
          };
        }
      }
      return { error: `No ${mode} route found` };
    }, mode);

    console.timeEnd("Page Load");

    await page.close();
    await browser.close();
    
    res.json(routeDetails);
  } catch (error) {
    console.error("Error fetching route:", error.message || error);
    res.status(500).json({ error: `Failed to fetch route details: ${error.message || "Unknown error"}` });
  } finally {
    if (browser) await browser.close(); // Ensure browser is closed in case of an error
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});