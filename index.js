import app from "./src/server/server.js";
import sendQueryInput from "./src/router/router.js";
import runScraper from "./src/scraper/scraper.js";

app.get('/api', (req, res) => {
  res.json({ message: 'API is working!' });
});

// app.post("/api/scrape", (req, res) => {

//   const data = req.body;
//   console.log(data.message);

//   sendQueryInput(data.message);

// })



app.post("/api/scrape", async (req, res) => {
    try {
        const data = req.body;
        console.log("Scraping query:", data.message);
        
        // Wait for the scraper to complete and get the results
        const results = await runScraper(data.message);
        
        // Send the JSON response
        res.json({
            success: true,
            data: JSON.parse(results),
            message: `Found ${JSON.parse(results).length} listings`
        });
        
    } catch (error) {
        console.error("Scraping error:", error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: "Failed to scrape data"
        });
    }
});

app.listen(3000, () => {  
console.log("Server is running on http://localhost:3000");
});