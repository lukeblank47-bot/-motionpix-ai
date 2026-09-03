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

Create a realistic 5-second live-action video.

Keep the subject exactly the same.

Use natural movement, lighting, shadows and camera motion.

Avoid warping, morphing, flickering or CGI-looking movement.

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
/*

  AI SOUND EFFECTS

*/

app.post("/api/generate-sound", async (req, res) => {

  try {

    const prompt = String(req.body.prompt || "").trim();

    if (!prompt) {

      return res.status(400).json({

        error: "Please enter a prompt."

      });

    }

    const soundPrompt =

      `Realistic sound effects and natural ambience matching this scene: ${prompt}. No narration or music unless requested.`;

    const task = await runwayRequest("sound_effect", {

      model: "eleven_text_to_sound_v2",

      promptText: soundPrompt,

      duration: 5

    });

    const audioUrl = await waitForTask(task.id);

    res.json({

      success: true,

      url: audioUrl,

      audioUrl: audioUrl

    });

  } catch (error) {

    console.error("Sound generation error:", error);

    res.status(500).json({

      error: error.message || "Sound generation failed."
    });
    }
    });
    


    
  

  const fs = require("fs");

const { spawn } = require("child_process");

const ffmpegPath = require("ffmpeg-static");

const generatedDir = path.join(__dirname, "generated");

if (!fs.existsSync(generatedDir)) {

  fs.mkdirSync(generatedDir, { recursive: true });

}

async function downloadFile(url, filePath) {

  const response = await fetch(url);

  if (!response.ok) {

    throw new Error("Could not download generated media.");

  }

  const buffer = Buffer.from(await response.arrayBuffer());

  fs.writeFileSync(filePath, buffer);

}

async function combineVideoAndAudio(videoUrl, audioUrl) {

  const id =

    Date.now() + "-" + Math.random().toString(36).slice(2, 8);

  const videoPath = path.join(

    generatedDir,

    `${id}-video.mp4`

  );

  const audioPath = path.join(

    generatedDir,

    `${id}-audio.mp3`

  );

  const outputName = `${id}-final.mp4`;

  const outputPath = path.join(generatedDir, outputName);

  await downloadFile(videoUrl, videoPath);

  await downloadFile(audioUrl, audioPath);

  await new Promise((resolve, reject) => {

    const ffmpeg = spawn(ffmpegPath, [

      "-y",

      "-i",

      videoPath,

      "-i",

      audioPath,

      "-c:v",

      "copy",

      "-c:a",

      "aac",

      "-shortest",

      outputPath

    ]);

    let errorText = "";

    ffmpeg.stderr.on("data", (data) => {

      errorText += data.toString();

    });

    ffmpeg.on("close", (code) => {

      if (code === 0) {

        resolve();

      } else {

        reject(

          new Error(

            "Could not attach sound to video: " + errorText

          )

        );

      }

    });

    ffmpeg.on("error", reject);

  });

  try {

    fs.unlinkSync(videoPath);

    fs.unlinkSync(audioPath);

  } catch (error) {

    console.log("Temporary file cleanup skipped.");

  }

  return `/generated/${outputName}`;

}

  app.post("/api/combine-audio", async (req, res) => {

  try {

    const { videoUrl, audioUrl } = req.body || {};

    if (!videoUrl || !audioUrl) {

      return res.status(400).json({

        error: "Missing videoUrl or audioUrl"

      });

    }

    const finalUrl = await combineVideoAndAudio(

      videoUrl,

      audioUrl

    );

    res.json({

      success: true,

      url: finalUrl

    });

  } catch (error) {

    console.error("Combine audio error:", error);

    res.status(500).json({

      error: error.message || "Failed to combine audio and video"

    });

  }

});
app.listen(PORT, () => {

  console.log(`MotionPix AI is running on port ${PORT}`);

});
