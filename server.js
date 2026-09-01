const express = require("express");

const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));

app.use(express.static(__dirname));

app.get("/", (req, res) => {

  res.sendFile(path.join(__dirname, "index.html"));

});

app.get("/generate", (req, res) => {

  res.sendFile(path.join(__dirname, "generate.html"));

});

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

    throw new Error(

      data.error ||

      data.message ||

      "Runway request failed"

    );

  }

  return data;

}

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

      throw new Error(

        task.failure || "Generation failed"

      );

    }

  }

}

function makePhotoRealistic(prompt) {

  return `${prompt}. Photorealistic professional photography,

physically accurate proportions and geometry,

authentic real-world materials and textures,

natural lighting, realistic reflections and shadows,

real camera optics, fine surface detail,

believable depth, true-to-life colors,

high-end professional photography,

no illustration, no cartoon,

no CGI appearance, no 3D-render appearance.`;

}

app.post("/api/generate-image", async (req, res) => {

  try {

    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {

      return res.status(400).json({

        error: "Prompt is required"

      });

    }

    const task = await runwayRequest(

      "text_to_image",

      {

        model: "gen4_image",

        promptText: makePhotoRealistic(

          prompt.trim()

        ),

        ratio: "1280:720"

      }

    );

    const result = await waitForTask(task.id);

    res.json({

      url: result.output?.[0]

    });

  } catch (error) {

    console.error(error);

    res.status(500).json({

      error:

        error.message ||

        "Image generation failed"

    });

  }

});

app.post("/api/generate-video", async (req, res) => {

  try {

    const { prompt, imageUrl } = req.body;

    if (!prompt || !prompt.trim()) {

      return res.status(400).json({

        error: "Prompt is required"

      });

    }

    const body = {

      model: "gen4.5",

      promptText: `${prompt.trim()}.

Natural physically believable movement,

realistic camera movement,

stable object geometry,

consistent fine details between frames,

cinematic live-action footage,

realistic lighting and reflections,

natural motion blur,

no morphing,

no warping,

no cartoon appearance,

no CGI appearance.`,

      ratio: "1280:720",

      duration: 5

    };

    if (imageUrl) {

      body.promptImage = imageUrl;

    }

    const task = await runwayRequest(

      "image_to_video",

      body

    );

    const result = await waitForTask(task.id);

    res.json({

      url: result.output?.[0]

    });

  } catch (error) {

    console.error(error);

    res.status(500).json({

      error:

        error.message ||

        "Video generation failed"

    });

  }

});

app.listen(PORT, () => {

  console.log(

    `MotionPix AI is running on port ${PORT}`

  );

});
