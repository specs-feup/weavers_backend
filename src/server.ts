import * as fs from "fs";
import "dotenv/config";
import * as path from "path";
import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
//import { runWeaver } from "./weaver";
import { randomUUID } from "crypto";
const { StaticPool } = require("node-worker-threads-pool");

const N_THREADS = 6;

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

const tempDir = "temp";

// Create a pool with 4 workers
const pool = new StaticPool({
  size: N_THREADS, // number of threads
  task: path.resolve(__dirname, "weaver.js"),
});

// Define proper types for multer files
interface MulterFiles {
  zipfile?: Express.Multer.File[];
  file?: Express.Multer.File[];
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const sessionId = (req as any).sessionId;
    const uploadDir = path.join(tempDir, sessionId, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // this attaches the correct file extension to the uploaded file
    // we do this because clava requires the script file to be .js
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + randomUUID().slice(0, 8) + extension);
  },
});

const upload = multer({ storage: storage });

// This intercepts the request to /api/weave, generating a unique session ID for each request.
// Then routes the request to the actual /api/weave endpoint.
app.use("/api/weave", (req, res, next) => {
  (req as any).sessionId = randomUUID().slice(0, 8); // Generate a short session ID
  next();
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Backend listening at http://localhost:${PORT}`);
  });
}

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

app.post(
  "/api/weave",
  upload.fields([
    { name: "name", maxCount: 1 },
    /*
    { name: 'zipfile', maxCount: 1 },
    { name: 'file', maxCount: 1 },
*/
  ]),
  async (req: Request, res: Response) => {
    console.log("========= ENDPOINT HIT =========");
    console.log("Request received at:", new Date().toISOString());

    //const tool = process.env.TOOL;
    //const tool = "clava";
    //const files = req.files as MulterFiles;
    const sessionId = (req as any).sessionId;
    const tool = (req as any).body.tool;
    console.log("SessionId:", sessionId);
    console.log("Tool:", tool);
    /*
    console.log("Files:", files);

    if (!files || (!files.zipfile && !files.file)) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
      */
    console.log("Received request body:", req.body);
    console.log("Args from request:", req.body.args);

    // Get args
    const inputCode = (req as any).body.sourceCode;
    const sourceFilename = (req as any).body.sourceFilename;
    const scriptCode = (req as any).body.script;
    const args = JSON.parse((req as any).body.flags || "[]");
    const sessionTempDir = path.join(tempDir, sessionId);

    console.log("sourceCode:", inputCode);
    console.log("script:", scriptCode);
    console.log("flags:", args);

    console.log("Using args:", args);

    try {
      const result = await pool.exec({
        tool: tool,
        inputCode: inputCode,
        sourceFilename: sourceFilename,
        scriptCode: scriptCode,
        args: args,
        sessionTempDir: sessionTempDir,
      });
      res.json({ result });
      
    } catch (err: any) {
      console.error(err);
      res.status(200).json({
        fileNames: [],
        outputs: [],
        mainFile: -1,
        console: err,
        exceptionOccured: true,
      });
    }

    /*
    runWeaver(
      tool || "",
      inputCode || "",
      sourceFilename || "",
      scriptCode || "",
      args,
      sessionTempDir
    )
      .then((result) => {
        console.log("Weaver tool executed successfully");

        // Just return the result of the backend
        res.status(200).json(result);
      })
      .catch((error) => {
        console.error("Weaver error:", error);
        res.status(200).json({
          fileNames: [],
          outputs: [],
          mainFile: -1,
          console: error,
          exceptionOccured: true,
        });
      });*/
  }
);

export default app;
