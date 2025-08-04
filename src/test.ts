/*
const otherApp = require("@specs-feup/clava/src-code/index.js");

otherApp("classic", "--help");
*/
import { spawn } from "child_process";

//const { exec } = require("child_process");
/*
exec("npx clava classic --help", (error: { message: any; }, stdout: any, stderr: any) => {
  if (error) {
    console.error(`Execution error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Error output: ${stderr}`);
  }
  console.log(`Output: ${stdout}`);
});
*/

const child = spawn("   ", ["clava", "classic", "--help"]);

child.stdout.on("data", (data) => {
  console.log(`stdout: ${data}`);
});

child.stderr.on("data", (data) => {
  console.error(`stderr: ${data}`);
});

child.on("close", (code) => {
  console.log(`Child process exited with code ${code}`);
});
