import express, { json } from 'express';
import { Client } from '@gradio/client';
import cors from 'cors';
import multer from 'multer';
import { readFileSync, existsSync, unlinkSync } from 'fs';

const app = express();
const port = 3001;

app.use(cors());
app.use(json());

const upload = multer({ dest: 'uploads/' });
let client = null;
try {
  client = await Client.connect("https://967ed119555536f81d.gradio.live", { timeout: 30000 });
  if(client) {
    console.log("Connected to Gradio client successfully.");
  }
} catch (e) {
  console.error("connect failed:", e);
  console.error("cause:", e?.cause);
}

app.post('/api/chat', upload.single('image'), async (req, res) => {
  const { url, text } = req.body;
  const imagePath = req.file ? req.file.path : null;

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {

    const userContent = [
      {
        "type": "text",
        "text": text
      }
    ];

    if (imagePath) {
      const buffer = readFileSync(imagePath);
      const base64Image = buffer.toString('base64');
      userContent.push({
        "type": "image_url",
        "image_url": {
          "url": `data:image/png;base64,${base64Image}`
        }
      });
    }

    const messages = JSON.stringify([
      {
        "role": "system",
        "content": [
          {
            "type": "text",
            "text": "you are a medical assistant."
          }
        ]
      },
      {
        "role": "user",
        "content": userContent
      }
    ]);

    const result = client.submit("/chat_with_ollama_JSON", { messages });

    let cumulativeMessage = "";

    for await (const response of result) {
      console.log('Received response from Gradio:', response);
      const jsonData = JSON.parse(response["data"][0]);
      cumulativeMessage += jsonData.at(-1)["message"]["content"];
      console.log('Cumulative message:', cumulativeMessage);
      res.write(`data: ${JSON.stringify({ message: cumulativeMessage })}\n\n`);

      if (jsonData.at(-1)["done_reason"] === "stop") {
        result.cancel();
        break;
      }
    }
    console.log(result);
    res.write(`data: DONE\n\n`);
    res.end();
  } catch (error) {
    console.error(error);
    res.write(`data: ERROR: ${error.message}\n\n`);
    res.end();
  } finally {
    // Clean up uploaded file
    if (imagePath && existsSync(imagePath)) {
      unlinkSync(imagePath);
    }
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
