const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const csv = require("csv-parser");
const multer = require("multer");
require("dotenv").config();

const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);



const app = express();

const port = 3000;
app.use(cors());

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

async function uploadToGemini(path, mimeType) {
  const uploadResult = await fileManager.uploadFile(path, {
    mimeType,
    displayName: path,
  });
  const file = uploadResult.file;
  console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
  return file;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});

const upload = multer({ storage: storage }).single("image");
let filePath;

app.post("/upload", (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error("Error during file upload:", err);
     return res.status(500).json({ error: "Failed to upload file." });

    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    filePath = req.file.path

     

          try {
            function fileToGenerativePart(path, mimeType){
              
              return {
                  path: filePath,
                  mimeType: mimeType,
                inlineData: {
                  data: Buffer.from(fs.readFileSync(path)).toString("base64"),
                  mimeType
                }
              }
            }
      // Set generation configuration for the Gemini API
      const generationConfig = {
        temperature: 0.9,
        topP: 1,
        maxOutputTokens: 2048,
        responseMimeType: "text/plain",
      };

      // Start a chat session with the generative model
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
      });

      const prompt = req.body.message
      const answer = await model.generateContent([prompt, fileToGenerativePart(filePath, "image/jpeg")])
      const response = await answer.response
      const text = response.text()
      return res.send(text)

      
    } catch (error) {
      console.error("Error during Gemini API call:", error);
      return res.status(500).json({ error: "Failed to process message with Gemini API" });
    }
  });
});
// Array to hold the custom data
const customData = [];

// Load CSV data into customData
fs.createReadStream(path.join(__dirname, "scholaships.csv"))
  .pipe(csv())
  .on("data", (data) => customData.push(data))
  .on("end", () => {
    console.log("CSV data loaded:", customData);
  });

// Function to get a custom response from the loaded data
function getCustomResponse(message) {
  // Normalize the message
  const key = message.toLowerCase().replace(/[^a-z]/g, "");
  // Search for a matching entry in the custom data
  const entry = customData.find((item) =>
    item["Scholarship Name"].toLowerCase().includes(key)
  );
  return entry
    ? `Scholarship Name: ${entry["Scholarship Name"]}, Type: ${entry["Scholarship Type"]}, Host Country: ${entry["Host Country"]}, Eligibility: ${entry["Eligibility"]}, Application Dateline: ${entry["Application Dateline"]}, Link: ${entry["Application Link"]}`
    : null;
}

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use("/styles", express.static(path.join(__dirname, "styles")));
app.use("/scripts", express.static(path.join(__dirname, "scripts")));
app.use("/assets", express.static(path.join(__dirname, "loader")));
app.use(express.static(path.join(__dirname)));

// Serve the index.html file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// API endpoint for messages
app.post("/api/message", async (req, res) => {
  const { message, filePath } = req.body;

  // **Prioritize custom data first**
  const customResponse = getCustomResponse(message);
  if (customResponse) {
    return res.json({ reply: customResponse });
  }

  try {
    // Set generation configuration
    const generationConfig = {
      temperature: 0.9,
      topP: 1,
      maxOutputTokens: 2048,
      responseMimeType: "text/plain",
    };

    

    const files = [
    await uploadToGemini(filePath, "image/jpeg"),
  ];

    const chatSession = model.startChat({
    generationConfig,

    history: [{
        role: "user",
        parts: [
          {
            fileData: {
              mimeType: files[0].mimeType,
              fileUri: files[0].uri,
            },
          },
        ],
      },
    ],
  });

  const result = await chatSession.sendMessage(message);
  console.log(result.response.text());

    
    res.json({ reply: result.response.text() });
  } catch (error) {
    console.error("Error generating response:", error);
    res.status(500).json({
      reply: "Sorry, something went wrong while generating the response.",
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
