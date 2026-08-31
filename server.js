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

// Runway request helper

async function runwayRequest(endpoint, body) {

  const response = await fetch(

    `https://api.dev.runwayml.com/v1/${endpoint}`,

    {

      method: "POST",

      headers: {

        Authorization: `Bearer ${process.env.RUNWAYML_API_SECRET}`,

        "Content-Type": "application/json",

        "X-Runway-Version": "2024-11-06"

      },

      body: JSON.stringify(body)

    }

  );

  const data = await response.json();

  if (!response.ok) {

    throw new Error(data.error || data.message || "Runway request failed");

  }

  return data;

}

// Wait until Runway finishes generating

async function waitForTask(taskId) {

  while (true) {

    await new Promise(resolve => setTimeout(resolve, 5000));

    const response = await fetch(

      `https://api.dev.runwayml.com/v1/tasks/${taskId}`,

      {

        headers: {

          Authorization: `Bearer ${process.env.RUNWAYML_API_SECRET}`,

          "X-Runway-Version": "2024-11-06"

        }

      }

    );

    const task = await response.json();

    if (task.status === "SUCCEEDED") {

      return task;

    }

    if (task.status === "FAILED") {

      throw new Error(task.failure || "Generation failed");

    }

  }

}

// Generate an AI image

app.post("/api/generate-image", async (req, res) => {

  try {

    const { prompt } = req.body;

    if (!prompt) {

      return res.status(400).json({ error: "Prompt is required" });

    }

    const task = await runwayRequest("text_to_image", {

      model: "gen4_image",

      promptText: prompt,

      ratio: "1280:720"

    });

    const result = await waitForTask(task.id);

    res.json({

      url: result.output?.[0]

    });

  } catch (error) {

    console.error(error);

    res.status(500).json({

      error: error.message || "Image generation failed"

    });

  }

});

// Generate an AI video

app.post("/api/generate-video", async (req, res) => {

  try {

    const { prompt } = req.body;

    if (!prompt) {

      return res.status(400).json({ error: "Prompt is required" });

    }

    const task = await runwayRequest("text_to_video", {

      model: "gen4.5",

      promptText: prompt,

      ratio: "1280:720",

      duration: 5

    });

    const result = await waitForTask(task.id);

    res.json({

      url: result.output?.[0]

    });

  } catch (error) {

    console.error(error);

    res.status(500).json({

      error: error.message || "Video generation failed"

    });

  }

});

app.listen(PORT, () => {

  console.log(`MotionPix AI is running on port ${PORT}`);

});
