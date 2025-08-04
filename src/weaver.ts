/*
This file provides the functions needed to Weave the input files received by the backend server.
*/

import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
const { parentPort, workerData } = require("worker_threads");

/**
 * The input data for a weaver execution.
 */
interface WorkerData {
  /** The Weaver tool to use (e.g., 'clava') */
  tool: string;
  /** The source code to weave */
  sourceCode: string;
  /** The name of the source file */
  sourceFilename: string;
  /** The javascript file to use for weaving */
  scriptFile: string;
  /** The arguments to use for weaving (e.g., '-std c++11') */
  args: string[];
  /** The temporary directory where files will be writte. It is deleted after the call */
  tempDir: string;
}

/**
 * The output data of the weaver execution.
 */
interface WorkerOutput {
  /** The names of the weaved source files */
  fileNames: string[];
  /** The source code of the weaved source files */
  outputs: string[];
  /** The index of the main source file */
  mainFile: number;
  /** The console output of the execution */
  console: string;
  /** True if an exception occurred, false otherwise */
  exceptionOccured: boolean;
}

/**
 *
 * @param tool The Weaver tool to use (e.g., 'clava')
 * @param sourceCode The source code to weave
 * @param source
 * @param scriptFile The javascript file to use for weaving
 * @param args The Arguments to use for weaving (e.g., '-std c++11')
 * @param tempDir The temporary directory to use for input and output files (default is 'temp/')
 * @returns A promise that resolves to an object representing an WorkerOutput
 */
/**
 *
 * @param data
 * @returns
 */
async function runWeaver(data: WorkerData): Promise<WorkerOutput> {
  const tool = data.tool;
  const sourceCode = data.sourceCode;
  const sourceFilename = data.sourceFilename;
  const scriptFile = data.scriptFile;
  const args = data.args;
  const tempDir = data.tempDir;

  console.log("=== runWeaver called ===");
  console.log("tool:", tool);
  console.log("sourceCode:", sourceCode);
  console.log("sourceFilename:", sourceFilename);
  console.log("scriptFile:", scriptFile);
  console.log("args:", args);
  console.log("tempDir:", tempDir);

  // Throw error if any of the required parameters are missing
  if (!tool) {
    throw new Error("Missing required parameters: tool");
  }
  if (!sourceCode) {
    throw new Error("Missing required parameters: sourceCode");
  }
  if (!scriptFile) {
    throw new Error("Missing required parameters: scriptFile");
  }

  // Create the input directory and input files
  const inputPath = path.join(tempDir, sourceFilename);

  try {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log("Folder '" + tempDir + "' created successfully!");
  } catch (err) {
    throw err;
  }

  fs.writeFile(inputPath, sourceCode, "utf8", (err) => {
    if (err) {
      throw new Error("Error writing file '" + inputPath + "':", err);
    }
    console.log("File '" + inputPath + "' written successfully!");
  });

  const scriptPath = path.join(tempDir, "exec.js");
  fs.writeFile(scriptPath, scriptFile, "utf8", (err) => {
    if (err) {
      throw new Error("Error writing file '" + scriptPath + "':", err);
    }
    console.log("File '" + scriptPath + "' written successfully!");
  });

  const finalArgs = [
    tool,
    "classic",
    scriptPath,
    "-p",
    inputPath,
    "-o",
    tempDir,
    ...args,
  ];

  console.log(`Running command: npx ${finalArgs.join(" ")}`);

  let logContent = "";
  let exceptionOccured = false;

  await new Promise<void>((resolve, reject) => {
    execFile("npx", finalArgs, (error, stdout, stderr) => {
      // Concatenate stdout, stderr and error for the log
      //logContent = stdout + "\n\n" + stderr + "\n" + error + "\n\n";

      logContent = stdout;

      if (error != null) {
        logContent += "\n\n" + error;
      }

      if (error) {
        // If the process itself failed, a.k.a exit code is not 0
        reject(logContent);
        exceptionOccured = true;
      } else if (stderr && /error/i.test(stderr)) {
        // If stderr contains an error message
        reject(logContent);
        exceptionOccured = true;
      } else {
        resolve();
      }
    });
  });

  const fileNames: string[] = [];
  const outputs: string[] = [];
  let mainFile = -1;

  // Load generated files
  if (!exceptionOccured) {
    mainFile = 0;

    // Output directory
    const resultFolderName = "woven_code";
    const resultFolder = path.join(tempDir, resultFolderName);

    // Read all generated files
    // TODO: Should receive as parameters a filter with supported extensions?
    try {
      const files = fs.readdirSync(resultFolder);

      console.log("Found files in folder '" + resultFolder + "': " + files);

      // By default, set index to 0
      mainFile = -1;
      let index = -1;
      files.forEach((file) => {
        index++;
        const filepath = path.join(resultFolder, file);

        console.log("Processing file '" + filepath + "'");

        const data = fs.readFileSync(filepath, "utf8");
        console.log("Filenames before: " + fileNames);
        fileNames.push(file);
        console.log("Filenames after: " + fileNames);
        outputs.push(data);
        if (file === sourceFilename) {
          mainFile = index;
        }
      });

      // In case sourceFilename was not found
      if (mainFile == -1 && index > -1) {
        mainFile = 0;
      }
    } catch (err) {
      console.error("Error reading directory '" + resultFolder + "'", err);
      exceptionOccured = true;
    }
  }

  // Clean up session directory on weaver failure
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // Return the log content and woven_code file contents
  return {
    fileNames: fileNames,
    outputs: outputs,
    mainFile: mainFile,
    console: logContent,
    exceptionOccured: exceptionOccured,
  };
}

runWeaver(workerData as WorkerData)
  .then((result) => parentPort?.postMessage({ success: true, result }))
  .catch((err) =>
    parentPort?.postMessage({ success: false, error: err.message })
  );
