/*
This file provides the functions needed to Weave the input files received by the backend server.
*/

import * as fs from "fs";
import * as path from "path";
import unzipper from "unzipper";
import archiver from "archiver";
import { execFile } from "child_process";

/**
 * Unzips a zip file to a target directory using unzipper.
 * @param zipPath - Path to the zip file.
 * @param targetDir - Directory to extract to.
 * @returns Promise<void>
 */
async function unzipFile(zipPath: string, targetDir: string): Promise<void> {
  await fs
    .createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: targetDir }))
    .promise();
}

/**
 * Zips a folder to a specified output path using archiver.
 * @param sourceFolder Source folder to zip
 * @param outPath Output path for the zip file
 * @returns Promise<void>
 */
function zipFolder(sourceFolder: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", (err: Error) => reject(err));

    archive.pipe(output);
    // Include the folder itself in the zip with the name "woven_code"
    archive.directory(sourceFolder, "woven_code");
    archive.finalize();
  });
}

/**
 *
 * @param tool The Weaver tool to use (e.g., 'clava')
 * @param inputFile The input file to weave, which is a zip file that will be unzipped
 * @param scriptFile The javascript file to use for weaving
 * @param args The Arguments to use for weaving (e.g., '-std c++11')
 * @param tempDir The temporary directory to use for input and output files (default is 'temp/')
 * @returns A promise that resolves to an object with log content string and path to woven code zip
 */
async function runWeaver(
  tool: string,
  sourceCode: string,
  sourceFilename: string,
  scriptFile: string,
  args: string[],
  tempDir: string = "temp/"
) {
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
    //throw new Error("Error creating folder '" + tempDir + "': " + err);
  }

  //  await unzipFile(inputFile, inputPath);
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
    //const outputPath = path.join(resultFolder, sourceFilename);

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

  //const outputZipPath = path.join(tempDir, `${resultFolderName}.zip`);

  // Zip the 'input' folder inside the 'woven_code' folder, but name it 'woven_code' in the ZIP
  //const inputFolderInWovenCode = path.join(tempDir, resultFolderName, "input");
  //await zipFolder(inputFolderInWovenCode, outputZipPath);

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

export { runWeaver };
