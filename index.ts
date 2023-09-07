import express from 'express';
import { Request, Response } from 'express';
import * as crypto from "crypto";
import bodyParser from 'body-parser';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from "@octokit/auth-app";

// Gather envornment variables and accept undefined values
const WEBHOOK_SECRET: string = process.env.WEBHOOK_SECRET!;
const GH_APP_ID: string = process.env.GH_APP_ID!;
const GH_APP_INSTALL_ID: string = process.env.GH_APP_INSTALL_ID!;
const GH_PRIVATE_KEY: string = process.env.GH_PRIVATE_KEY!;

// Set some more constants
const PORT: number = 80; // port of applicaiton
const SLEEP: number = 30; // number of seconds to sleep before sending the POST
const MODE: string = "approved"; // change to "rejected" to cancel deployment

// set up express erver
const app = express();

// use body parser for express
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

// listen for POST requests on /
app.post('/', async (req, res) => {

  // validate secret
  console.log("Validating secret...");
  if (!verify_signature(req)) {
    console.log("Secret sent was invalid.");
    res.status(401).send("Unauthorized");
    return;
  }

  // validate the type of request
  console.log("Validating payload received...");
  if (req.body['deployment_callback_url'] === undefined) {
    console.log("Skipping non-deployment webhook.");
    res.send("OK");
    return;
  }

  // make sure payload contains an environment name
  if (req.body['deployment'] === undefined 
    || req.body['deployment']['environment'] == undefined) {
    return handle_error(res, "No deployment environment provided in payload.");
  }

  // validate all secrets are provided
  console.log("Validating environment variables...");
  if (WEBHOOK_SECRET === undefined 
    || GH_APP_ID == undefined 
    || GH_APP_INSTALL_ID == undefined 
    || GH_PRIVATE_KEY == undefined) {
    return handle_error(
      res, 
      "Please make sure all environment variables are provided. Some are missing."
    );
  }


  // create octokit for communication to GitHub using GitHub App
  console.log("Setting up GitHub connection...");
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: GH_APP_ID,
      privateKey: GH_PRIVATE_KEY,
      installationId: GH_APP_INSTALL_ID,
    },
  });

  /////////////////////////////////////////////
  // logic for third party runs would go here
  /////////////////////////////////////////////

  // post update messages while sleeping (async)
  let current_wait = SLEEP;
  setInterval(() => {
    // update status in CLI and GUI
    let message = `${current_wait} seconds left to sleep...`;
    console.log(message);
    octokit.request(`POST ${req.body['deployment_callback_url']}`, {
      environment_name: req.body['deployment']['environment'],
      comment: message
    });
    current_wait -= 1;
    return;
  }, 1000);

  // sleep for same amount of time
  await sleep(SLEEP);

  // send approval/rejection
  await octokit.request(`POST ${req.body['deployment_callback_url']}`, {
    environment_name: req.body['deployment']['environment'],
    state: MODE,
    comment: "Passed external tests."
  });

  // send back OK response
  res.send('OK');
  return;
})

// function to start the servers
app.listen(PORT, () => {
  console.log(`The application is listening on port ${PORT}!`);
})

// verification method
const verify_signature = (req: Request) => {
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("hex");
  const trusted = Buffer.from(`sha256=${signature}`, 'ascii');
  const untrusted = Buffer.from(`${req.headers["x-hub-signature-256"]}`, 'ascii');
  return crypto.timingSafeEqual(trusted, untrusted);
};

// quick handling of errors
const handle_error = (res: Response, message: string) => {
  console.log(message)
  res.status(500);
  res.send('500 Server Error');
}

// sleep function
const sleep = (s: number) => new Promise(r => setTimeout(r, (s * 1000)));