import express from 'express';
import { Request, Response } from 'express';
import * as crypto from "crypto";
import bodyParser from 'body-parser';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from "@octokit/auth-app";

// set constants
const WEBHOOK_SECRET: string = process.env.WEBHOOK_SECRET!;
const GH_APP_ID: string = process.env.GH_APP_ID!;
const GH_APP_INSTALL_ID: string = process.env.GH_APP_INSTALL_ID!;
const GH_PRIVATE_KEY: string = process.env.GH_PRIVATE_KEY!;
const PORT: number = 80

// create octokit for communication to GitHub
const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: GH_APP_ID,
    privateKey: GH_PRIVATE_KEY,
    installationId: GH_APP_INSTALL_ID,
  },
});

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
  if (!verify_signature(req)) {
    res.status(401).send("Unauthorized");
    return;
  }

  // validate the type of request
  if (req.body['deployment_callback_url'] === undefined) {
    res.send("Skipping non-deployment webhook.");
    return;
  }

  // make sure payload contains an environment name
  if (req.body['deployment'] === undefined || req.body['deployment']['environment'] == undefined) {
    return handle_error(res, "No deployment environment provided in payload.");
  }

  // logic for third party runs

  // send approval
  await octokit.request(`POST ${req.body['deployment_callback_url']}`, {
    environment_name: req.body['deployment']['environment'],
    state: "approved",
    comment: "Passed external tests."
  });

  res.send('OK');
})

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