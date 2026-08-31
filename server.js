const express = require("express");

const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(express.static(__dirname));

app.get("/", (req, res) => {

  res.sendFile(path.join(__dirname, "index.html"));

});

app.get("/generate", (req, res) => {

  res.sendFile(path.join(__dirname, "generate.html"));

});
app.post("/api/generate-video", async (req, res) => {

  try {

    const { prompt } = req.body;

    const response = await fetch(

      "https://queue.fal.run/fal-ai/kling-video/o3/standard/text-to-video",

      {

        method: "POST",

        headers: {

          "Authorization": `Key ${process.env.FAL_KEY}`,

          "Content-Type": "application/json"

        },

        body: JSON.stringify({

          prompt: prompt

        })

      }

    );

    const data = await response.json();

    res.json(data);

  } catch (error) {

    res.status(500).json({ error: error.message });

  }

});

app.listen(PORT, () => {

  console.log(`MotionPix AI is running on port ${PORT}`);

});
