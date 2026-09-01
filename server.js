const express = require("express");

const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));

app.use(express.static(__dirname));

app.get("/", (req, res) => {

  res.sendFile(path.join(__dirname, "index.html"));

});

app.get("/generate", (req, res) => {

  res.sendFile(path.join(__dirname, "generate.html"));

});

const RUNWAY_URL = "https://api.dev.runwayml.com/v1";

const RUNWAY_VERSION = "2024-11-06";

async function runwayRequest(endpoint, body) {

  if (!process.env.RUNWAYML_API_SECRET) {

    throw new Error("RUNWAYML_API_SECRET is missing in Render.");

  }

  const response = await fetch(`${RUNWAY_URL}/${endpoint}`, {

    method: "POST",

    headers: {

      "Content-Type": "application/json",

      Authorization: `Bearer ${process.env.RUNWAYML_API_SECRET}`,

      "X-Runway-Version": RUNWAY_VERSION

    },

    body: JSON.stringify(body)

  });

  const data = await response.json();

  if (!response.ok) {

    console.error("Runway error:", data);

    throw new Error(

      data?.error ||

      data?.message ||

      `Runway request failed (${response.status})`

    );

  }

  return data;

}

async function getTask(taskId) {

  const response = await fetch(`${RUNWAY_URL}/tasks/${taskId}`, {

    headers: {

      Authorization: `Bearer ${process.env.RUNWAYML_API_SECRET}`,

      "X-Runway-Version": RUNWAY_VERSION

    }

  });

  const data = await response.json();

  if (!response.ok) {

    throw new Error(

      data?.error ||

      data?.message ||

      `Could not check task (${response.status})`

    );

  }

  return data;

}

function sleep(ms) {

  return new Promise(resolve => setTimeout(resolve, ms));

}

async function waitForTask(taskId) {

  for (let i = 0; i < 120; i++) {

    const task = await getTask(taskId);

    console.log("Runway task:", task.status);

    if (task.status === "SUCCEEDED") {

      if (!task.output || !task.output[0]) {

        throw new Error("Runway finished but returned no output.");

      }

      return task.output[0];

    }

    if (

      task.status === "FAILED" ||

      task.status === "CANCELED" ||

      task.status === "CANCELLED"

    ) {

      throw new Error(

        task.failure ||

        task.failureCode ||

        "Runway generation failed."

      );

    }

    await sleep(3000);

  }

  throw new Error("Generation took too long. Please try again.");

}

/*

  IMAGE GENERATION

*/

app.post("/api/generate-image", async (req, res) => {

  try {

    const prompt = String(

      req.body.prompt ||

      req.body.promptText ||

      ""

    ).trim();

    if (!prompt) {

      return res.status(400).json({

        error: "Please enter a prompt."

      });

    }

    const task = await runwayRequest("text_to_image", {

      model: "gen4_image",

      promptText: prompt,

      ratio: "1920:1080"

    });

    const imageUrl = await waitForTask(task.id);

    res.json({

      success: true,

      url: imageUrl,

      imageUrl: imageUrl,

      output: [imageUrl]

    });

  } catch (error) {

    console.error("Image generation error:", error);

    res.status(500).json({

      error: error.message || "Image generation failed."

    });

  }

});

/*

  TEXT TO VIDEO

*/

app.post("/api/generate-video", async (req, res) => {

  try {

    const prompt = String(

      req.body.prompt ||

      req.body.promptText ||

      ""

    ).trim();

    if (!prompt) {

      return res.status(400).json({

        error: "Please enter a prompt."

      });

    }

    const improvedPrompt = `

${prompt}

Photorealistic live-action footage.

Natural real-world physics and movement.

Realistic lighting, shadows and reflections.

Stable subject appearance throughout the shot.

Natural camera motion.

Cinematic professional camera footage.

Avoid warping, morphing, flickering or unnatural motion.

`.trim();

    const task = await runwayRequest("image_to_video", {

      model: "gen4.5",

      promptText: improvedPrompt,

      ratio: "1280:720",

      duration: 5

    });

    const videoUrl = await waitForTask(task.id);

    res.json({

      success: true,

      url: videoUrl,

      videoUrl: videoUrl,

      output: [videoUrl]

    });

  } catch (error) {

    console.error("Video generation error:", error);

    res.status(500).json({

      error: error.message || "Video generation failed."

    });

  }

});

/*

  IMAGE TO VIDEO

*/

app.post("/api/image-to-video", async (req, res) => {

  try {

    const imageUrl =

      req.body.imageUrl ||

      req.body.image ||

      req.body.promptImage;

    const originalPrompt = String(

      req.body.prompt ||

      req.body.promptText ||

      ""

    ).trim();

    if (!imageUrl) {

      return res.status(400).json({

        error: "An image is required."

      });

    }

    /*

      This prompt tells Gen-4.5 to preserve the generated

      image instead of redesigning the subject.

    */

    const motionPrompt = `

${originalPrompt}

Preserve the exact appearance, shape, proportions, color and details of the subject in the source image.

Create photorealistic live-action footage with realistic physical movement.

Keep the subject consistent and stable throughout the entire shot.

Use natural acceleration and realistic wheel, body and environmental motion when applicable.

The background should move with correct perspective and parallax.

Natural sunlight, physically realistic shadows and reflections.

Smooth professional tracking camera movement with subtle natural camera motion.

Maintain realistic depth of field and photographic detail.

Do not redesign the subject.

Do not change its shape or color.

Avoid morphing, warping, flickering, floating, sliding or rubbery motion.

Avoid artificial CGI-looking movement.

`.trim();

    const task = await runwayRequest("image_to_video", {

      model: "gen4.5",

      promptImage: imageUrl,

      promptText: motionPrompt,

      ratio: "1280:720",

      duration: 5

    });

    const videoUrl = await waitForTask(task.id);

    res.json({

      success: true,

      url: videoUrl,

      videoUrl: videoUrl,

      output: [videoUrl]

    });

  } catch (error) {

    console.error("Image-to-video error:", error);

    res.status(500).json({

      error: error.message || "Image-to-video generation failed."

    });

  }

});

app.listen(PORT, () => {

  console.log(`MotionPix AI is running on port ${PORT}`);

});
